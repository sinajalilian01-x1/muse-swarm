//! Muse Swarm contract.
//!
//! Four AI robots run an art business together for a human owner. Each robot is its own NEAR
//! account and holds only a function-call key for its own methods on this contract:
//!
//! * Curator `curator_open_job`: picks a real trend and opens a job (only one job at a time).
//! * Painter `painter_submit`: pays for image inference and submits the artwork (IPFS CID).
//! * Critic  `critic_review`: pays for a vision review and scores it. Only a score at or above the
//!   owner's threshold is minted as a NEP-171 token (held by this contract until sold).
//! * Seller  `seller_list`: lists the token at a price between the owner's floor and max price.
//!
//! Every robot has its own budget inside this contract. Inference fees go to the `treasury_id`
//! (which settles with the AI provider), never to a robot account, so nothing gets stranded on a
//! function-call-only account. Storage for jobs, tokens and listings is paid from the robot that
//! caused it. Robots can `robot_refuel` a little NEAR to their own account to pay gas.
//!
//! Anyone can `buy` a listed work. The price is split on-chain: the owner's share is paid to the
//! owner's wallet and each robot's share refills that robot's budget, so the swarm funds itself.
//! A robot budget above `budget_cap` is swept to the owner. Owner rules are enforced here:
//! price floor and max price, per-robot daily spend cap, per-fee cap, daily job cap, score
//! threshold, kill switch, and a short guardian pause that releases itself (for the public demo).
//! Every money movement emits a `muse_swarm` NEP-297 event so the ledger is rebuilt from chain.

use near_contract_standards::non_fungible_token::core::{NonFungibleTokenCore, NonFungibleTokenResolver};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::{self, json};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise, PromiseOrValue};
use std::collections::HashMap;

pub const NS_PER_DAY: u64 = 86_400_000_000_000;
pub const JOB_TIMEOUT_MS: u64 = 10 * 60 * 1000;
pub const GUARDIAN_MAX_PAUSE_SECS: u32 = 120;
pub const MIN_FLOOR: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR
pub const MAX_REFUEL: u128 = 500_000_000_000_000_000_000_000; // 0.5 NEAR per call
/// Agents hire each other: the Painter pays the Curator for each brief it paints from,
/// and the Seller pays the Critic for each appraisal it lists on. Budget to budget, on-chain.
pub const BRIEF_FEE: u128 = 2_000_000_000_000_000_000_000; // 0.002 NEAR
pub const APPRAISAL_FEE: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
/// The Seller may re-price an unsold listing (within floor/max) once it has sat this long.
pub const REPRICE_AFTER_MS: u64 = 15 * 60 * 1000;
const PINATA_BASE_URI: &str = "https://gateway.pinata.cloud/ipfs";

pub const CURATOR: usize = 0;
pub const PAINTER: usize = 1;
pub const CRITIC: usize = 2;
pub const SELLER: usize = 3;
pub const ROLES: [&str; 4] = ["curator", "painter", "critic", "seller"];

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    NonFungibleToken,
    Metadata,
    TokenMetadata,
    Enumeration,
    Jobs,
    Listings,
    TokenJob,
}

/// Revenue split in basis points. Must sum to 10_000.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Split {
    pub owner: u16,
    pub curator: u16,
    pub painter: u16,
    pub critic: u16,
    pub seller: u16,
}

impl Split {
    fn robots(&self) -> [u16; 4] {
        [self.curator, self.painter, self.critic, self.seller]
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Rules {
    /// Lowest price the Seller may list at.
    pub floor: U128,
    /// Highest price the Seller may list at.
    pub max_price: U128,
    /// Critic score (0-100, i.e. 7.0/10 = 70) needed to mint.
    pub score_threshold: u8,
    /// Max a single robot may spend per UTC day (fees + storage + refuel).
    pub daily_cap: U128,
    /// Max for one inference fee.
    pub fee_cap: U128,
    /// A robot budget above this is swept to the owner after a sale.
    pub budget_cap: U128,
    /// Max jobs the Curator may open per UTC day.
    pub max_jobs_per_day: u32,
    pub split: Split,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Robot {
    pub role: String,
    pub account_id: AccountId,
    pub budget: U128,
    pub spent_today: U128,
    pub day: U64,
    pub spent_total: U128,
    pub fees_total: U128,
    pub storage_total: U128,
    pub refuel_total: U128,
    pub earned_total: U128,
    pub swept_total: U128,
    pub actions: u32,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct Stats {
    pub jobs: u32,
    pub minted: u32,
    pub rejected: u32,
    pub expired: u32,
    pub sold: u32,
    pub revenue_total: U128,
    pub owner_paid_total: U128,
    pub robots_earned_total: U128,
    pub fees_total: U128,
    pub storage_total: U128,
    pub refuel_total: U128,
    pub funded_total: U128,
    pub withdrawn_total: U128,
    pub jobs_today: u32,
    pub day: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Job {
    pub id: U64,
    /// briefed -> painted -> minted -> listed -> sold, or rejected / expired
    pub status: String,
    pub trend: String,
    pub source: String,
    pub brief: String,
    pub title: String,
    pub media: String,
    pub score: u8,
    pub note: String,
    pub token_id: Option<TokenId>,
    pub price: U128,
    pub buyer: Option<AccountId>,
    /// Total fees + storage the robots spent on this job.
    pub cost: U128,
    pub opened_at_ms: U64,
    pub updated_at_ms: U64,
}

#[near(serializers = [json])]
pub struct SwarmView {
    pub owner_id: AccountId,
    pub treasury_id: AccountId,
    pub guardian_id: AccountId,
    pub rules: Rules,
    pub robots: Vec<Robot>,
    pub stats: Stats,
    pub kill_switch: bool,
    pub paused_until_ms: U64,
    pub live: bool,
    pub active_job: Option<Job>,
    pub next_job: U64,
    pub listings: u32,
    pub now_ms: U64,
}

#[near(serializers = [json])]
pub struct Listing {
    pub token_id: TokenId,
    pub job_id: U64,
    pub price: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    treasury_id: AccountId,
    guardian_id: AccountId,
    rules: Rules,
    robots: Vec<Robot>,
    stats: Stats,
    kill_switch: bool,
    paused_until_ns: u64,
    active_job: Option<u64>,
    next_job: u64,
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    jobs: IterableMap<u64, Job>,
    listings: IterableMap<TokenId, u128>,
    token_job: LookupMap<TokenId, u64>,
}

fn emit(event: &str, data: serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({"standard":"muse_swarm","version":"1.0.0","event":event,"data":[data]})
    ));
}

fn pay(to: &AccountId, amount: u128) {
    if amount > 0 {
        let _ = Promise::new(to.clone()).transfer(NearToken::from_yoctonear(amount));
    }
}

fn now_ms() -> u64 {
    env::block_timestamp() / 1_000_000
}

fn clip(s: String, max: usize) -> String {
    if s.len() <= max {
        return s;
    }
    let mut end = max;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

/// Split a sale price: (owner share, [curator, painter, critic, seller] shares).
/// Rounding dust goes to the owner so the shares always add up to the price exactly.
pub fn split_sale(price: u128, split: &Split) -> (u128, [u128; 4]) {
    let mut robots = [0u128; 4];
    let mut sum = 0;
    for (i, bps) in split.robots().iter().enumerate() {
        robots[i] = price * (*bps as u128) / 10_000;
        sum += robots[i];
    }
    (price - sum, robots)
}

pub fn validate_rules(r: &Rules) {
    let s = &r.split;
    let total = s.owner as u32 + s.curator as u32 + s.painter as u32 + s.critic as u32 + s.seller as u32;
    require!(total == 10_000, "Split must add up to 10000 bps");
    require!(r.floor.0 >= MIN_FLOOR, "Floor must be at least 0.01 NEAR");
    require!(r.max_price.0 >= r.floor.0, "Max price must be >= floor");
    require!(r.score_threshold <= 100, "Score threshold is 0-100");
    require!(r.fee_cap.0 <= r.daily_cap.0, "Fee cap must be <= daily cap");
    require!(r.max_jobs_per_day >= 1, "At least one job per day");
}

#[near]
impl Contract {
    #[init]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        owner_id: AccountId,
        treasury_id: AccountId,
        guardian_id: AccountId,
        curator_id: AccountId,
        painter_id: AccountId,
        critic_id: AccountId,
        seller_id: AccountId,
        rules: Rules,
    ) -> Self {
        validate_rules(&rules);
        let metadata = NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Muse Swarm".to_string(),
            symbol: "MUSE".to_string(),
            icon: Some("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M32 4 58 20v24L32 60 6 44V20z' fill='%2316A39C'/%3E%3Cpath d='M32 4 58 20 32 34z' fill='%23F6C53E'/%3E%3Cpath d='M32 34 58 44 32 60z' fill='%23F47A38'/%3E%3C/svg%3E".to_string()),
            base_uri: Some(PINATA_BASE_URI.to_string()),
            reference: None,
            reference_hash: None,
        };
        let day = env::block_timestamp() / NS_PER_DAY;
        let robots = [curator_id, painter_id, critic_id, seller_id]
            .into_iter()
            .enumerate()
            .map(|(i, account_id)| Robot {
                role: ROLES[i].to_string(),
                account_id,
                budget: U128(0),
                spent_today: U128(0),
                day: U64(day),
                spent_total: U128(0),
                fees_total: U128(0),
                storage_total: U128(0),
                refuel_total: U128(0),
                earned_total: U128(0),
                swept_total: U128(0),
                actions: 0,
            })
            .collect();
        Self {
            owner_id: owner_id.clone(),
            treasury_id,
            guardian_id,
            rules,
            robots,
            stats: Stats { day: U64(day), ..Default::default() },
            kill_switch: false,
            paused_until_ns: 0,
            active_job: None,
            next_job: 1,
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                owner_id,
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                None::<StorageKey>,
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            jobs: IterableMap::new(StorageKey::Jobs),
            listings: IterableMap::new(StorageKey::Listings),
            token_job: LookupMap::new(StorageKey::TokenJob),
        }
    }

    // ------------------------------------------------------------------ owner

    /// Fund robot budgets. With `role` the whole deposit goes to that robot, otherwise it is
    /// shared equally by all four. Anyone may fund (patrons too).
    #[payable]
    pub fn fund(&mut self, role: Option<String>) -> Vec<Robot> {
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach NEAR to fund the swarm");
        match role {
            Some(r) => {
                let i = Self::role_index(&r);
                self.robots[i].budget = U128(self.robots[i].budget.0 + amount);
            }
            None => {
                let each = amount / 4;
                for i in 0..4 {
                    let extra = if i == 0 { amount - each * 4 } else { 0 };
                    self.robots[i].budget = U128(self.robots[i].budget.0 + each + extra);
                }
            }
        }
        self.stats.funded_total = U128(self.stats.funded_total.0 + amount);
        emit("funded", json!({"from": env::predecessor_account_id(), "amount": U128(amount),
            "budgets": self.robots.iter().map(|r| r.budget).collect::<Vec<_>>()}));
        self.robots.clone()
    }

    pub fn update_rules(&mut self, rules: Rules) -> Rules {
        self.assert_owner();
        validate_rules(&rules);
        self.rules = rules;
        emit("rules_updated", json!({"rules": self.rules}));
        self.rules.clone()
    }

    /// Owner kill switch: while engaged no robot can spend, mint or list. Stays until released.
    pub fn set_kill_switch(&mut self, engaged: bool) -> bool {
        self.assert_owner();
        self.kill_switch = engaged;
        if !engaged {
            self.paused_until_ns = 0;
        }
        emit("kill_switch", json!({"engaged": engaged, "by": env::predecessor_account_id()}));
        engaged
    }

    /// Short pause that releases itself. The guardian (used by the public demo) may pause for
    /// at most 120 s; the owner for up to a day.
    pub fn guardian_pause(&mut self, seconds: u32) -> U64 {
        let caller = env::predecessor_account_id();
        let is_owner = caller == self.owner_id;
        require!(is_owner || caller == self.guardian_id, "Guardian or owner only");
        let max = if is_owner { 86_400 } else { GUARDIAN_MAX_PAUSE_SECS };
        require!(seconds >= 1 && seconds <= max, "Pause too long");
        self.paused_until_ns = env::block_timestamp() + seconds as u64 * 1_000_000_000;
        let until = U64(self.paused_until_ns / 1_000_000);
        emit("paused", json!({"by": caller, "seconds": seconds, "until_ms": until}));
        until
    }

    /// Owner takes NEAR out of a robot budget.
    pub fn withdraw(&mut self, role: String, amount: U128) -> U128 {
        self.assert_owner();
        let i = Self::role_index(&role);
        require!(amount.0 > 0 && amount.0 <= self.robots[i].budget.0, "Amount exceeds robot budget");
        self.robots[i].budget = U128(self.robots[i].budget.0 - amount.0);
        self.stats.withdrawn_total = U128(self.stats.withdrawn_total.0 + amount.0);
        pay(&self.owner_id.clone(), amount.0);
        emit("withdrawn", json!({"role": role, "amount": amount, "to": self.owner_id, "budget": self.robots[i].budget}));
        self.robots[i].budget
    }

    /// Owner rotates a robot to a new account (e.g. after a key leak).
    pub fn set_robot(&mut self, role: String, account_id: AccountId) {
        self.assert_owner();
        let i = Self::role_index(&role);
        self.robots[i].account_id = account_id.clone();
        emit("robot_set", json!({"role": role, "account_id": account_id}));
    }

    pub fn set_guardian(&mut self, guardian_id: AccountId) {
        self.assert_owner();
        self.guardian_id = guardian_id;
    }

    pub fn set_treasury(&mut self, treasury_id: AccountId) {
        self.assert_owner();
        self.treasury_id = treasury_id;
    }

    // ------------------------------------------------------------------ robots

    /// Curator: open a job for a real trend. Only one job may be active; a job that has not
    /// moved for 10 minutes expires so the swarm can never get stuck.
    pub fn curator_open_job(&mut self, trend: String, source: String, brief: String, fee: U128, model: String) -> Job {
        self.assert_robot(CURATOR);
        self.assert_live();
        self.roll_day();
        if let Some(id) = self.active_job {
            let j = self.jobs.get(&id).cloned().unwrap();
            require!(now_ms() >= j.updated_at_ms.0 + JOB_TIMEOUT_MS, "Another job is in progress");
            self.close_job(id, "expired");
            self.stats.expired += 1;
        }
        require!(self.stats.jobs_today < self.rules.max_jobs_per_day, "Daily job cap reached");
        require!(!trend.trim().is_empty(), "Empty trend");
        let id = self.next_job;
        self.next_job += 1;
        let t = U64(now_ms());
        let job = Job {
            id: U64(id),
            status: "briefed".into(),
            trend: clip(trend, 80),
            source: clip(source, 160),
            brief: clip(brief, 240),
            title: String::new(),
            media: String::new(),
            score: 0,
            note: String::new(),
            token_id: None,
            price: U128(0),
            buyer: None,
            cost: U128(0),
            opened_at_ms: t,
            updated_at_ms: t,
        };
        let before = env::storage_usage();
        self.jobs.insert(id, job);
        self.jobs.flush();
        let storage = self.storage_cost_since(before);
        self.active_job = Some(id);
        self.stats.jobs += 1;
        self.stats.jobs_today += 1;
        self.charge(CURATOR, fee.0, storage, id, &model);
        let j = self.jobs.get(&id).cloned().unwrap();
        emit("job_opened", json!({"job_id": U64(id), "trend": j.trend, "source": j.source, "by": self.robots[CURATOR].account_id}));
        j
    }

    /// Painter: submit the artwork (IPFS CID) for the active job and pay its inference fee.
    pub fn painter_submit(&mut self, job_id: U64, title: String, media: String, fee: U128, model: String) -> Job {
        self.assert_robot(PAINTER);
        self.assert_live();
        self.roll_day();
        let mut j = self.active_job_with(job_id.0, "briefed");
        require!(!media.is_empty() && !title.trim().is_empty(), "Title and media required");
        j.title = clip(title, 60);
        j.media = clip(media, 100);
        j.status = "painted".into();
        j.updated_at_ms = U64(now_ms());
        let before = env::storage_usage();
        self.jobs.insert(job_id.0, j);
        self.jobs.flush();
        let storage = self.storage_cost_since(before);
        self.charge(PAINTER, fee.0, storage, job_id.0, &model);
        self.pay_agent(PAINTER, CURATOR, BRIEF_FEE, job_id.0, "brief");
        let j = self.jobs.get(&job_id.0).cloned().unwrap();
        emit("painted", json!({"job_id": job_id, "title": j.title, "media": j.media, "by": self.robots[PAINTER].account_id}));
        j
    }

    /// Critic: score the artwork 0-100. At or above the owner's threshold it is minted as a
    /// NEP-171 token held by this contract; below it, the job is rejected and nothing is minted.
    pub fn critic_review(&mut self, job_id: U64, score: u8, note: String, fee: U128, model: String) -> Job {
        self.assert_robot(CRITIC);
        self.assert_live();
        self.roll_day();
        require!(score <= 100, "Score is 0-100");
        let mut j = self.active_job_with(job_id.0, "painted");
        j.score = score;
        j.note = clip(note, 160);
        j.updated_at_ms = U64(now_ms());
        let before = env::storage_usage();
        let approved = score >= self.rules.score_threshold;
        if approved {
            let token_id = format!("{}", job_id.0);
            let md = TokenMetadata {
                title: Some(j.title.clone()),
                description: None,
                media: Some(j.media.clone()),
                media_hash: None,
                copies: Some(1),
                issued_at: Some(format!("{}", now_ms())),
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: Some(json!({"score": score, "job": job_id}).to_string()),
                reference: None,
                reference_hash: None,
            };
            self.tokens.internal_mint_with_refund(token_id.clone(), env::current_account_id(), Some(md), None);
            self.token_job.insert(token_id.clone(), job_id.0);
            self.token_job.flush();
            j.token_id = Some(token_id.clone());
            j.status = "minted".into();
            self.stats.minted += 1;
            NftMint { owner_id: &env::current_account_id(), token_ids: &[&token_id], memo: Some("muse-swarm") }.emit();
        } else {
            j.status = "rejected".into();
            self.stats.rejected += 1;
            self.active_job = None;
        }
        self.jobs.insert(job_id.0, j);
        self.jobs.flush();
        let storage = self.storage_cost_since(before);
        self.charge(CRITIC, fee.0, storage, job_id.0, &model);
        let j = self.jobs.get(&job_id.0).cloned().unwrap();
        emit(if approved { "approved" } else { "rejected" }, json!({"job_id": job_id, "score": score,
            "threshold": self.rules.score_threshold, "token_id": j.token_id, "by": self.robots[CRITIC].account_id}));
        j
    }

    /// Seller: list the minted work between the owner's floor and max price. Closes the job.
    pub fn seller_list(&mut self, job_id: U64, price: U128) -> Job {
        self.assert_robot(SELLER);
        self.assert_live();
        self.roll_day();
        require!(price.0 >= self.rules.floor.0, "Price is below the owner's floor");
        require!(price.0 <= self.rules.max_price.0, "Price is above the owner's max price");
        if let Some(listed) = self.jobs.get(&job_id.0).cloned().filter(|j| j.status == "listed") {
            return self.reprice(listed, price);
        }
        let mut j = self.active_job_with(job_id.0, "minted");
        let token_id = j.token_id.clone().unwrap();
        j.price = price;
        j.status = "listed".into();
        j.updated_at_ms = U64(now_ms());
        let before = env::storage_usage();
        self.listings.insert(token_id.clone(), price.0);
        self.listings.flush();
        self.jobs.insert(job_id.0, j);
        self.jobs.flush();
        let storage = self.storage_cost_since(before);
        self.active_job = None;
        self.charge(SELLER, 0, storage, job_id.0, "-");
        self.pay_agent(SELLER, CRITIC, APPRAISAL_FEE, job_id.0, "appraisal");
        emit("listed", json!({"job_id": job_id, "token_id": token_id, "price": price, "floor": self.rules.floor,
            "by": self.robots[SELLER].account_id}));
        self.jobs.get(&job_id.0).cloned().unwrap()
    }

    /// A robot moves a little of its own budget to its own account to pay for gas.
    /// That NEAR can only be burned as gas (robots hold function-call keys only).
    pub fn robot_refuel(&mut self, amount: U128) -> U128 {
        let caller = env::predecessor_account_id();
        let i = self.robots.iter().position(|r| r.account_id == caller).unwrap_or_else(|| env::panic_str("Robot only"));
        self.assert_live();
        require!(amount.0 > 0 && amount.0 <= MAX_REFUEL, "Refuel is 0-0.5 NEAR");
        self.spend(i, amount.0);
        self.robots[i].refuel_total = U128(self.robots[i].refuel_total.0 + amount.0);
        self.stats.refuel_total = U128(self.stats.refuel_total.0 + amount.0);
        pay(&caller, amount.0);
        emit("refueled", json!({"role": ROLES[i], "account_id": caller, "amount": amount, "budget": self.robots[i].budget}));
        self.robots[i].budget
    }

    // ------------------------------------------------------------------ market

    /// Buy a listed work. Attach at least the price; any excess is refunded. The price is split
    /// on-chain: owner share to the owner's wallet, robot shares into robot budgets (anything above
    /// the budget cap is swept to the owner).
    #[payable]
    pub fn buy(&mut self, token_id: TokenId) -> serde_json::Value {
        let buyer = env::predecessor_account_id();
        let deposit = env::attached_deposit().as_yoctonear();
        let price = self.listings.get(&token_id).copied().unwrap_or_else(|| env::panic_str("Not for sale"));
        require!(deposit >= price, "Attached deposit is below the price");
        require!(buyer != env::current_account_id(), "Swarm cannot buy its own work");
        self.listings.remove(&token_id);
        self.tokens.internal_transfer(&env::current_account_id(), &buyer, &token_id, None, Some("muse-swarm sale".into()));

        let (owner_share, robot_shares) = split_sale(price, &self.rules.split);
        let mut to_owner = owner_share;
        let mut swept = [0u128; 4];
        let cap = self.rules.budget_cap.0;
        for i in 0..4 {
            let r = &mut self.robots[i];
            r.earned_total = U128(r.earned_total.0 + robot_shares[i]);
            let mut b = r.budget.0 + robot_shares[i];
            if b > cap {
                swept[i] = b - cap;
                b = cap;
                r.swept_total = U128(r.swept_total.0 + swept[i]);
                to_owner += swept[i];
            }
            r.budget = U128(b);
        }
        let job_id = self.token_job.get(&token_id).copied().unwrap_or(0);
        if let Some(j) = self.jobs.get(&job_id).cloned() {
            let mut j = j;
            j.status = "sold".into();
            j.buyer = Some(buyer.clone());
            j.updated_at_ms = U64(now_ms());
            self.jobs.insert(job_id, j);
        }
        self.stats.sold += 1;
        self.stats.revenue_total = U128(self.stats.revenue_total.0 + price);
        self.stats.owner_paid_total = U128(self.stats.owner_paid_total.0 + to_owner);
        self.stats.robots_earned_total = U128(self.stats.robots_earned_total.0 + robot_shares.iter().sum::<u128>());
        pay(&self.owner_id.clone(), to_owner);
        pay(&buyer, deposit - price);
        emit("sold", json!({"job_id": U64(job_id), "token_id": token_id, "buyer_id": buyer, "price": U128(price)}));
        let shares: Vec<U128> = robot_shares.iter().map(|v| U128(*v)).collect();
        let sweeps: Vec<U128> = swept.iter().map(|v| U128(*v)).collect();
        emit("split_paid", json!({"token_id": token_id, "owner_id": self.owner_id, "owner_amount": U128(to_owner),
            "robot_shares": shares, "swept": sweeps,
            "budgets": self.robots.iter().map(|r| r.budget).collect::<Vec<_>>()}));
        json!({"token_id": token_id, "price": U128(price), "owner_amount": U128(to_owner), "robot_shares": shares})
    }

    // ------------------------------------------------------------------ views

    pub fn get_swarm(&self) -> SwarmView {
        let today = env::block_timestamp() / NS_PER_DAY;
        let mut robots = self.robots.clone();
        for r in robots.iter_mut() {
            if r.day.0 != today {
                r.spent_today = U128(0);
            }
        }
        let mut stats = self.stats.clone();
        if stats.day.0 != today {
            stats.jobs_today = 0;
        }
        SwarmView {
            owner_id: self.owner_id.clone(),
            treasury_id: self.treasury_id.clone(),
            guardian_id: self.guardian_id.clone(),
            rules: self.rules.clone(),
            robots,
            stats,
            kill_switch: self.kill_switch,
            paused_until_ms: U64(self.paused_until_ns / 1_000_000),
            live: self.is_live(),
            active_job: self.active_job.and_then(|id| self.jobs.get(&id).cloned()),
            next_job: U64(self.next_job),
            listings: self.listings.len(),
            now_ms: U64(now_ms()),
        }
    }

    pub fn get_job(&self, job_id: U64) -> Option<Job> {
        self.jobs.get(&job_id.0).cloned()
    }

    /// Newest first. `before` is an exclusive job id to page backwards from.
    pub fn get_jobs(&self, before: Option<U64>, limit: Option<u32>) -> Vec<Job> {
        let mut id = before.map(|b| b.0).unwrap_or(self.next_job).min(self.next_job);
        let limit = limit.unwrap_or(20).min(50) as usize;
        let mut out = Vec::new();
        while id > 1 && out.len() < limit {
            id -= 1;
            if let Some(j) = self.jobs.get(&id) {
                out.push(j.clone());
            }
        }
        out
    }

    pub fn get_listings(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Listing> {
        self.listings
            .iter()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50) as usize)
            .map(|(t, p)| Listing { token_id: t.clone(), job_id: U64(self.token_job.get(t).copied().unwrap_or(0)), price: U128(*p) })
            .collect()
    }

    // ------------------------------------------------------------------ internals

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Owner only");
    }

    fn assert_robot(&self, i: usize) {
        if env::predecessor_account_id() != self.robots[i].account_id {
            env::panic_str(&format!("Only the {} robot can do this", ROLES[i]));
        }
    }

    fn is_live(&self) -> bool {
        !self.kill_switch && env::block_timestamp() >= self.paused_until_ns
    }

    fn assert_live(&self) {
        require!(!self.kill_switch, "Kill switch engaged: the owner has stopped the swarm");
        require!(env::block_timestamp() >= self.paused_until_ns, "Swarm paused: it resumes by itself shortly");
    }

    fn role_index(role: &str) -> usize {
        ROLES.iter().position(|r| *r == role).unwrap_or_else(|| env::panic_str("Unknown role"))
    }

    fn roll_day(&mut self) {
        let today = env::block_timestamp() / NS_PER_DAY;
        if self.stats.day.0 != today {
            self.stats.day = U64(today);
            self.stats.jobs_today = 0;
        }
    }

    fn storage_cost_since(&self, before: u64) -> u128 {
        env::storage_byte_cost().as_yoctonear() * env::storage_usage().saturating_sub(before) as u128
    }

    fn active_job_with(&self, id: u64, status: &str) -> Job {
        require!(self.active_job == Some(id), "Not the active job");
        let j = self.jobs.get(&id).cloned().unwrap_or_else(|| env::panic_str("Unknown job"));
        if j.status != status {
            env::panic_str(&format!("Job is {}, expected {}", j.status, status));
        }
        j
    }

    fn close_job(&mut self, id: u64, status: &str) {
        if let Some(j) = self.jobs.get(&id).cloned() {
            let mut j = j;
            j.status = status.into();
            j.updated_at_ms = U64(now_ms());
            self.jobs.insert(id, j);
        }
        self.active_job = None;
        emit("job_closed", json!({"job_id": U64(id), "status": status}));
    }

    /// Deduct from a robot budget under the daily cap.
    fn spend(&mut self, i: usize, amount: u128) {
        let today = env::block_timestamp() / NS_PER_DAY;
        let cap = self.rules.daily_cap.0;
        let r = &mut self.robots[i];
        if r.day.0 != today {
            r.day = U64(today);
            r.spent_today = U128(0);
        }
        require!(r.spent_today.0 + amount <= cap, "Daily spend cap reached for this robot");
        require!(amount <= r.budget.0, "Robot budget too low");
        r.budget = U128(r.budget.0 - amount);
        r.spent_today = U128(r.spent_today.0 + amount);
        r.spent_total = U128(r.spent_total.0 + amount);
        r.actions += 1;
    }

    /// One agent pays another from its budget (counts against the payer's daily cap). A payee budget
    /// above the cap is swept to the owner, same as sale proceeds.
    fn pay_agent(&mut self, from: usize, to: usize, amount: u128, job_id: u64, what: &str) {
        self.spend(from, amount);
        self.robots[from].actions -= 1; // part of the same action, not a new one
        let cap = self.rules.budget_cap.0;
        let r = &mut self.robots[to];
        let mut b = r.budget.0 + amount;
        let mut swept = 0;
        if b > cap {
            swept = b - cap;
            b = cap;
            r.swept_total = U128(r.swept_total.0 + swept);
        }
        r.budget = U128(b);
        if swept > 0 {
            self.stats.owner_paid_total = U128(self.stats.owner_paid_total.0 + swept);
            pay(&self.owner_id.clone(), swept);
        }
        emit("agent_paid", json!({"from": ROLES[from], "to": ROLES[to], "amount": U128(amount), "for": what, "job_id": U64(job_id),
            "swept": U128(swept), "budgets": self.robots.iter().map(|r| r.budget).collect::<Vec<_>>()}));
    }

    /// Seller re-prices an unsold listing (within floor/max), at most once per REPRICE_AFTER_MS.
    fn reprice(&mut self, mut j: Job, price: U128) -> Job {
        require!(now_ms() >= j.updated_at_ms.0 + REPRICE_AFTER_MS, "Too soon to re-price this listing");
        let token_id = j.token_id.clone().unwrap_or_else(|| env::panic_str("No token"));
        require!(self.listings.get(&token_id).is_some(), "Not listed");
        let old = j.price;
        self.listings.insert(token_id.clone(), price.0);
        j.price = price;
        j.updated_at_ms = U64(now_ms());
        self.jobs.insert(j.id.0, j.clone());
        self.robots[SELLER].actions += 1;
        emit("repriced", json!({"job_id": j.id, "token_id": token_id, "old_price": old, "price": price, "by": self.robots[SELLER].account_id}));
        j
    }

    /// Charge a robot for an inference fee (paid to the treasury) plus storage (kept by the contract).
    fn charge(&mut self, i: usize, fee: u128, storage: u128, job_id: u64, model: &str) {
        require!(fee <= self.rules.fee_cap.0, "Fee above the owner's per-call cap");
        self.spend(i, fee + storage);
        let r = &mut self.robots[i];
        r.fees_total = U128(r.fees_total.0 + fee);
        r.storage_total = U128(r.storage_total.0 + storage);
        self.stats.fees_total = U128(self.stats.fees_total.0 + fee);
        self.stats.storage_total = U128(self.stats.storage_total.0 + storage);
        if let Some(j) = self.jobs.get(&job_id).cloned() {
            let mut j = j;
            j.cost = U128(j.cost.0 + fee + storage);
            self.jobs.insert(job_id, j);
        }
        if fee > 0 {
            pay(&self.treasury_id.clone(), fee);
        }
        emit("charged", json!({"role": ROLES[i], "job_id": U64(job_id), "fee": U128(fee), "storage": U128(storage),
            "to": self.treasury_id, "model": clip(model.to_string(), 60), "budget": self.robots[i].budget}));
    }
}

// ---------------------------------------------------------------- NEP-171
#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo)
    }

    #[payable]
    fn nft_transfer_call(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>, msg: String) -> PromiseOrValue<bool> {
        self.tokens.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(&mut self, previous_owner_id: AccountId, receiver_id: AccountId, token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>) -> bool {
        self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 { self.tokens.nft_total_supply() }
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> { self.tokens.nft_tokens(from_index, limit) }
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 { self.tokens.nft_supply_for_owner(account_id) }
    fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata { self.metadata.get().unwrap() }
}

#[cfg(test)]
mod tests;
