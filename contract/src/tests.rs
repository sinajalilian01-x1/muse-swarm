use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const MILLI: u128 = NEAR / 1_000;
const T0: u64 = 1_800_000_000_000_000_000;

fn a(s: &str) -> AccountId { s.parse().unwrap() }
fn owner() -> AccountId { a("owner.testnet") }
fn treasury() -> AccountId { a("treasury.testnet") }
fn guardian() -> AccountId { a("guardian.testnet") }
fn curator() -> AccountId { a("curator.testnet") }
fn painter() -> AccountId { a("painter.testnet") }
fn critic() -> AccountId { a("critic.testnet") }
fn seller() -> AccountId { a("seller.testnet") }
fn buyer() -> AccountId { a("buyer.testnet") }
fn swarm() -> AccountId { a("swarm.testnet") }

fn ctx_at(who: AccountId, deposit: u128, ts: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(swarm())
        .predecessor_account_id(who.clone())
        .signer_account_id(who)
        .account_balance(NearToken::from_near(100))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(ts);
    testing_env!(b.build());
}
fn ctx(who: AccountId, deposit: u128) { ctx_at(who, deposit, T0) }

fn rules() -> Rules {
    Rules {
        floor: U128(50 * MILLI),
        max_price: U128(500 * MILLI),
        score_threshold: 70,
        daily_cap: U128(100 * MILLI),
        fee_cap: U128(10 * MILLI),
        budget_cap: U128(2 * NEAR),
        max_jobs_per_day: 5,
        split: Split { owner: 2_000, curator: 1_500, painter: 3_500, critic: 1_500, seller: 1_500 },
    }
}

/// Swarm with 4 NEAR of budget (1 NEAR per robot).
fn setup_with(r: Rules) -> Contract {
    ctx(owner(), 0);
    let mut c = Contract::new(owner(), treasury(), guardian(), curator(), painter(), critic(), seller(), r);
    ctx(owner(), 4 * NEAR);
    c.fund(None);
    c
}
fn setup() -> Contract { setup_with(rules()) }

fn open(c: &mut Contract) -> u64 {
    ctx(curator(), 0);
    c.curator_open_job("Northern lights".into(), "wikipedia".into(), "aurora over a quiet town".into(), U128(MILLI), "m".into()).id.0
}
fn paint(c: &mut Contract, id: u64) {
    ctx(painter(), 0);
    c.painter_submit(U64(id), "Aurora Hush".into(), "bafyexamplecid".into(), U128(5 * MILLI), "flux".into());
}
fn review(c: &mut Contract, id: u64, score: u8) -> Job {
    ctx(critic(), 0);
    c.critic_review(U64(id), score, "lovely".into(), U128(MILLI), "vl".into())
}
/// Full loop up to a listing at `price`; returns the token id.
fn listed(c: &mut Contract, price: u128) -> TokenId {
    let id = open(c);
    paint(c, id);
    let j = review(c, id, 85);
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(price), None, None);
    j.token_id.unwrap()
}
fn panics<F: FnOnce()>(f: F) -> bool {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).is_err()
}

#[test]
fn full_loop_mints_lists_and_sells() {
    let mut c = setup();
    let t = listed(&mut c, 100 * MILLI);
    assert_eq!(c.nft_token(t.clone()).unwrap().owner_id, swarm());
    ctx(buyer(), 100 * MILLI);
    c.buy(t.clone());
    assert_eq!(c.nft_token(t).unwrap().owner_id, buyer());
    let s = c.get_swarm();
    assert_eq!(s.stats.sold, 1);
    assert_eq!(s.stats.minted, 1);
    assert_eq!(s.stats.revenue_total.0, 100 * MILLI);
    assert!(s.active_job.is_none());
    assert_eq!(c.get_job(U64(1)).unwrap().status, "sold");
}

// ---------------------------------------------------------------- split math
#[test]
fn split_math_adds_up() {
    let s = rules().split;
    let (o, r) = split_sale(NEAR, &s);
    assert_eq!(o, 200 * MILLI);
    assert_eq!(r, [150 * MILLI, 350 * MILLI, 150 * MILLI, 150 * MILLI]);
    for p in [1u128, 7, 999, 123_456_789_012_345_678, 50 * MILLI + 3] {
        let (o, r) = split_sale(p, &s);
        assert_eq!(o + r.iter().sum::<u128>(), p, "shares must sum to the price");
    }
}

#[test]
fn sale_refills_robot_budgets_and_pays_owner() {
    let mut c = setup();
    let t = listed(&mut c, 200 * MILLI);
    let before: Vec<u128> = c.get_swarm().robots.iter().map(|r| r.budget.0).collect();
    ctx(buyer(), 250 * MILLI); // overpay: 0.05 refunded
    let r = c.buy(t);
    assert_eq!(r["owner_amount"], json!(U128(40 * MILLI)));
    let after: Vec<u128> = c.get_swarm().robots.iter().map(|r| r.budget.0).collect();
    assert_eq!(after[0] - before[0], 30 * MILLI);
    assert_eq!(after[1] - before[1], 70 * MILLI);
    assert_eq!(after[2] - before[2], 30 * MILLI);
    assert_eq!(after[3] - before[3], 30 * MILLI);
    assert_eq!(c.get_swarm().stats.owner_paid_total.0, 40 * MILLI);
}

#[test]
fn budget_cap_sweeps_surplus_to_owner() {
    let mut r = rules();
    r.budget_cap = U128(NEAR); // each robot starts at 1 NEAR, minus what it spends
    let mut c = setup_with(r);
    let t = listed(&mut c, 500 * MILLI);
    ctx(buyer(), 500 * MILLI);
    c.buy(t);
    let s = c.get_swarm();
    for rb in &s.robots {
        assert!(rb.budget.0 <= NEAR, "no robot may hold more than the budget cap");
    }
    let swept: u128 = s.robots.iter().map(|r| r.swept_total.0).sum();
    assert!(swept > 0);
    assert_eq!(s.stats.owner_paid_total.0, 100 * MILLI + swept);
}

// ---------------------------------------------------------------- floor / price
#[test]
#[should_panic(expected = "Price is below the owner's floor")]
fn floor_is_enforced() {
    let mut c = setup();
    let id = open(&mut c);
    paint(&mut c, id);
    review(&mut c, id, 90);
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(49 * MILLI), None, None);
}

#[test]
#[should_panic(expected = "Price is above the owner's max price")]
fn max_price_is_enforced() {
    let mut c = setup();
    let id = open(&mut c);
    paint(&mut c, id);
    review(&mut c, id, 90);
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(501 * MILLI), None, None);
}

#[test]
fn listing_at_floor_is_ok() {
    let mut c = setup();
    let t = listed(&mut c, 50 * MILLI);
    assert_eq!(c.get_listings(None, None)[0].token_id, t);
}

#[test]
#[should_panic(expected = "Attached deposit is below the price")]
fn underpaying_is_rejected() {
    let mut c = setup();
    let t = listed(&mut c, 100 * MILLI);
    ctx(buyer(), 99 * MILLI);
    c.buy(t);
}

// ---------------------------------------------------------------- score gate
#[test]
fn low_score_is_rejected_and_not_minted() {
    let mut c = setup();
    let id = open(&mut c);
    paint(&mut c, id);
    let j = review(&mut c, id, 69);
    assert_eq!(j.status, "rejected");
    assert!(j.token_id.is_none());
    assert_eq!(c.nft_total_supply().0, 0);
    assert!(c.get_swarm().active_job.is_none(), "a rejection frees the swarm for the next job");
    assert_eq!(c.get_swarm().stats.rejected, 1);
}

#[test]
fn score_at_threshold_is_minted() {
    let mut c = setup();
    let id = open(&mut c);
    paint(&mut c, id);
    assert_eq!(review(&mut c, id, 70).status, "minted");
    assert_eq!(c.nft_total_supply().0, 1);
}

// ---------------------------------------------------------------- caps
#[test]
fn daily_spend_cap_is_enforced_and_resets() {
    let mut r = rules();
    r.daily_cap = U128(12 * MILLI);
    r.fee_cap = U128(10 * MILLI);
    let mut c = setup_with(r);
    ctx(painter(), 0);
    c.robot_refuel(U128(10 * MILLI));
    assert!(panics(|| { c.robot_refuel(U128(3 * MILLI)); }), "13 > 12 daily cap");
    ctx_at(painter(), 0, T0 + NS_PER_DAY);
    c.robot_refuel(U128(3 * MILLI)); // new UTC day
    assert_eq!(c.get_swarm().robots[PAINTER].spent_today.0, 3 * MILLI);
}

#[test]
#[should_panic(expected = "Fee above the owner's per-call cap")]
fn fee_cap_is_enforced() {
    let mut c = setup();
    let id = open(&mut c);
    ctx(painter(), 0);
    c.painter_submit(U64(id), "x".into(), "cid".into(), U128(11 * MILLI), "m".into());
}

#[test]
fn daily_job_cap_is_enforced() {
    let mut r = rules();
    r.max_jobs_per_day = 2;
    let mut c = setup_with(r);
    for _ in 0..2 {
        let id = open(&mut c);
        paint(&mut c, id);
        review(&mut c, id, 10); // rejected, frees the slot
    }
    assert!(panics(|| { open(&mut c); }));
    ctx_at(curator(), 0, T0 + NS_PER_DAY);
    c.curator_open_job("t".into(), "s".into(), "b".into(), U128(0), "m".into());
}

#[test]
#[should_panic(expected = "Robot budget too low")]
fn budget_cannot_go_negative() {
    let mut r = rules();
    r.daily_cap = U128(10 * NEAR);
    let mut c = setup_with(r);
    ctx(painter(), 0);
    c.robot_refuel(U128(500 * MILLI));
    c.robot_refuel(U128(500 * MILLI));
    c.robot_refuel(U128(1)); // budget 1 NEAR is gone
}

#[test]
fn fees_go_to_treasury_not_robots() {
    let mut c = setup();
    open(&mut c);
    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"charged\"") && l.contains("treasury.testnet")));
    let s = c.get_swarm();
    assert_eq!(s.stats.fees_total.0, MILLI);
    assert!(s.robots[CURATOR].storage_total.0 > 0, "job storage is paid by the curator");
}

#[test]
fn only_one_job_at_a_time_and_stale_jobs_expire() {
    let mut c = setup();
    open(&mut c);
    assert!(panics(|| { open(&mut c); }), "second job while one is active");
    ctx_at(curator(), 0, T0 + (JOB_TIMEOUT_MS + 1) * 1_000_000);
    let j = c.curator_open_job("t".into(), "s".into(), "b".into(), U128(0), "m".into());
    assert_eq!(j.id.0, 2);
    assert_eq!(c.get_job(U64(1)).unwrap().status, "expired");
}

#[test]
#[should_panic(expected = "Job is briefed, expected painted")]
fn stages_cannot_be_skipped() {
    let mut c = setup();
    let id = open(&mut c);
    review(&mut c, id, 90);
}

// ---------------------------------------------------------------- kill switch
#[test]
fn kill_switch_blocks_every_robot_method() {
    let mut c = setup();
    let id = open(&mut c);
    ctx(owner(), 0);
    c.set_kill_switch(true);
    assert!(!c.get_swarm().live);
    ctx(painter(), 0);
    assert!(panics(|| { c.painter_submit(U64(id), "x".into(), "cid".into(), U128(0), "m".into()); }));
    assert!(panics(|| { c.robot_refuel(U128(MILLI)); }));
    ctx(curator(), 0);
    assert!(panics(|| { c.curator_open_job("t".into(), "s".into(), "b".into(), U128(0), "m".into()); }));
    ctx(owner(), 0);
    c.set_kill_switch(false);
    paint(&mut c, id); // works again
}

#[test]
fn kill_switch_blocks_review_and_listing() {
    let mut c = setup();
    let id = open(&mut c);
    paint(&mut c, id);
    ctx(owner(), 0);
    c.set_kill_switch(true);
    assert!(panics(|| { review(&mut c, id, 90); }));
    ctx(owner(), 0);
    c.set_kill_switch(false);
    review(&mut c, id, 90);
    ctx(owner(), 0);
    c.set_kill_switch(true);
    ctx(seller(), 0);
    assert!(panics(|| { c.seller_list(U64(id), U128(100 * MILLI), None, None); }));
}

#[test]
fn guardian_pause_releases_itself() {
    let mut c = setup();
    ctx(guardian(), 0);
    c.guardian_pause(60);
    assert!(!c.get_swarm().live);
    ctx_at(curator(), 0, T0 + 30 * 1_000_000_000);
    assert!(panics(|| { c.curator_open_job("t".into(), "s".into(), "b".into(), U128(0), "m".into()); }));
    ctx_at(curator(), 0, T0 + 61 * 1_000_000_000);
    assert!(c.get_swarm().live, "auto-released after 60 s with no transaction");
    c.curator_open_job("t".into(), "s".into(), "b".into(), U128(0), "m".into());
}

#[test]
#[should_panic(expected = "Pause too long")]
fn guardian_cannot_pause_for_long() {
    let mut c = setup();
    ctx(guardian(), 0);
    c.guardian_pause(GUARDIAN_MAX_PAUSE_SECS + 1);
}

#[test]
#[should_panic(expected = "Guardian or owner only")]
fn strangers_cannot_pause() {
    let mut c = setup();
    ctx(buyer(), 0);
    c.guardian_pause(10);
}

#[test]
fn buying_still_works_while_paused() {
    let mut c = setup();
    let t = listed(&mut c, 100 * MILLI);
    ctx(owner(), 0);
    c.set_kill_switch(true);
    ctx(buyer(), 100 * MILLI);
    c.buy(t);
}

// ---------------------------------------------------------------- robot-only checks
#[test]
#[should_panic(expected = "Only the curator robot can do this")]
fn only_curator_opens_jobs() {
    let mut c = setup();
    ctx(painter(), 0);
    c.curator_open_job("t".into(), "s".into(), "b".into(), U128(0), "m".into());
}

#[test]
#[should_panic(expected = "Only the painter robot can do this")]
fn only_painter_submits() {
    let mut c = setup();
    let id = open(&mut c);
    ctx(curator(), 0);
    c.painter_submit(U64(id), "x".into(), "cid".into(), U128(0), "m".into());
}

#[test]
#[should_panic(expected = "Only the critic robot can do this")]
fn only_critic_reviews() {
    let mut c = setup();
    let id = open(&mut c);
    paint(&mut c, id);
    ctx(painter(), 0); // the painter may not grade its own work
    c.critic_review(U64(id), 100, "mine is great".into(), U128(0), "m".into());
}

#[test]
#[should_panic(expected = "Only the seller robot can do this")]
fn only_seller_lists() {
    let mut c = setup();
    let id = open(&mut c);
    paint(&mut c, id);
    review(&mut c, id, 90);
    ctx(owner(), 0);
    c.seller_list(U64(id), U128(100 * MILLI), None, None);
}

#[test]
#[should_panic(expected = "Robot only")]
fn only_robots_refuel() {
    let mut c = setup();
    ctx(buyer(), 0);
    c.robot_refuel(U128(MILLI));
}

#[test]
#[should_panic(expected = "Owner only")]
fn only_owner_changes_rules() {
    let mut c = setup();
    ctx(curator(), 0);
    c.update_rules(rules());
}

#[test]
#[should_panic(expected = "Owner only")]
fn only_owner_withdraws() {
    let mut c = setup();
    ctx(seller(), 0);
    c.withdraw("seller".into(), U128(MILLI));
}

#[test]
fn owner_can_withdraw_from_a_robot() {
    let mut c = setup();
    ctx(owner(), 0);
    let left = c.withdraw("painter".into(), U128(400 * MILLI));
    assert_eq!(left.0, 600 * MILLI);
    assert_eq!(c.get_swarm().stats.withdrawn_total.0, 400 * MILLI);
}

#[test]
#[should_panic(expected = "Split must add up to 10000 bps")]
fn bad_split_is_rejected() {
    let mut r = rules();
    r.split.owner = 2_001;
    setup_with(r);
}

#[test]
fn jobs_page_newest_first() {
    let mut c = setup();
    for _ in 0..3 {
        let id = open(&mut c);
        paint(&mut c, id);
        review(&mut c, id, 1);
    }
    let ids: Vec<u64> = c.get_jobs(None, Some(2)).iter().map(|j| j.id.0).collect();
    assert_eq!(ids, vec![3, 2]);
    let ids: Vec<u64> = c.get_jobs(Some(U64(2)), None).iter().map(|j| j.id.0).collect();
    assert_eq!(ids, vec![1]);
}

#[test]
fn agents_pay_each_other_for_briefs_and_appraisals() {
    let mut c = setup();
    let id = open(&mut c);
    let b0: Vec<u128> = c.robots.iter().map(|r| r.budget.0).collect();
    paint(&mut c, id);
    let b1: Vec<u128> = c.robots.iter().map(|r| r.budget.0).collect();
    assert_eq!(b1[CURATOR], b0[CURATOR] + BRIEF_FEE);
    assert!(b1[PAINTER] <= b0[PAINTER] - BRIEF_FEE);
    assert!(get_logs().iter().any(|l| l.contains("\"agent_paid\"") && l.contains("\"brief\"")));
    review(&mut c, id, 80);
    let b2: Vec<u128> = c.robots.iter().map(|r| r.budget.0).collect();
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(100 * MILLI), None, None);
    assert_eq!(c.robots[CRITIC].budget.0, b2[CRITIC] + APPRAISAL_FEE);
    assert!(c.robots[SELLER].budget.0 <= b2[SELLER] - APPRAISAL_FEE);
}

#[test]
fn seller_can_reprice_a_stale_listing_within_bounds() {
    let mut c = setup();
    let t = listed(&mut c, 200 * MILLI);
    let id: u64 = t.parse().unwrap();
    ctx_at(seller(), 0, T0 + (REPRICE_AFTER_MS + 1) * 1_000_000);
    let j = c.seller_list(U64(id), U128(150 * MILLI), None, None);
    assert_eq!(j.price.0, 150 * MILLI);
    assert_eq!(c.get_listings(None, None)[0].price.0, 150 * MILLI);
    assert!(get_logs().iter().any(|l| l.contains("\"repriced\"")));
    // still enforces the floor
    ctx_at(seller(), 0, T0 + (2 * REPRICE_AFTER_MS + 2) * 1_000_000);
    assert!(panics(|| { c.seller_list(U64(id), U128(10 * MILLI), None, None); }));
}

#[test]
fn reprice_too_soon_or_by_others_is_refused() {
    let mut c = setup();
    let t = listed(&mut c, 200 * MILLI);
    let id: u64 = t.parse().unwrap();
    ctx(seller(), 0);
    assert!(panics(|| { c.seller_list(U64(id), U128(150 * MILLI), None, None); }));
    ctx_at(painter(), 0, T0 + (REPRICE_AFTER_MS + 1) * 1_000_000);
    assert!(panics(|| { c.seller_list(U64(id), U128(150 * MILLI), None, None); }));
}

#[test]
fn repriced_listing_sells_at_new_price() {
    let mut c = setup();
    let t = listed(&mut c, 200 * MILLI);
    let id: u64 = t.parse().unwrap();
    ctx_at(seller(), 0, T0 + (REPRICE_AFTER_MS + 1) * 1_000_000);
    c.seller_list(U64(id), U128(120 * MILLI), None, None);
    ctx_at(buyer(), 120 * MILLI, T0 + (REPRICE_AFTER_MS + 2) * 1_000_000);
    c.buy(t.clone());
    assert_eq!(c.nft_token(t).unwrap().owner_id, buyer());
    assert_eq!(c.stats.revenue_total.0, 120 * MILLI);
}

// ---------------------------------------------------------------- v3: marketing + marketplaces
const MB: &str = "market-v2-beta.mintspace2.testnet";
fn plan() -> MarketingPlan {
    MarketingPlan { pitch: "A quiet aurora for night owls".into(), audience: "NEAR art collectors".into(), channel: "X".into(),
        best_time: "Tue 18:00 CET".into(), hashtags: vec!["#NEARHackathon".into(), "#lowpoly".into()], reference: Some("bafyplan".into()) }
}
fn approvals_on(c: &mut Contract) { ctx(owner(), 0); c.enable_approvals(); }

#[test]
fn new_mints_carry_full_nep177_metadata() {
    let mut c = setup();
    let t = listed(&mut c, 100 * MILLI);
    let md = c.nft_token(t).unwrap().metadata.unwrap();
    assert!(md.media.unwrap().starts_with("https://"));
    assert!(md.description.unwrap().contains("Critic robot at 8.5/10"));
}

#[test]
fn seller_logs_marketing_plan_and_sets_reference() {
    let mut c = setup();
    let id = open(&mut c); paint(&mut c, id); review(&mut c, id, 85);
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(100 * MILLI), Some(plan()), None);
    assert!(get_logs().iter().any(|l| l.contains("\"marketing_plan\"") && l.contains("night owls")));
    let md = c.nft_token("1".into()).unwrap().metadata.unwrap();
    assert_eq!(md.reference.as_deref(), Some("bafyplan"));
    // Same price again = re-market only, no 15-minute re-price rule.
    ctx(seller(), 0);
    let j = c.seller_list(U64(id), U128(100 * MILLI), Some(plan()), None);
    assert_eq!(j.price.0, 100 * MILLI);
}

#[test]
fn cross_list_needs_approvals_enabled_and_allowed_market() {
    let mut c = setup();
    let id = open(&mut c); paint(&mut c, id); review(&mut c, id, 85);
    ctx(seller(), 0);
    assert!(panics(|| { c.seller_list(U64(id), U128(100 * MILLI), None, Some(MB.parse().unwrap())); }));
    approvals_on(&mut c);
    ctx(seller(), 0);
    assert!(panics(|| { c.seller_list(U64(id), U128(100 * MILLI), None, Some("evil.testnet".parse().unwrap())); }));
    ctx(owner(), 0);
    assert!(panics(|| { ctx(buyer(), 0); c.enable_approvals(); }));
}

#[test]
fn cross_list_approves_market_and_charges_seller() {
    let mut c = setup();
    approvals_on(&mut c);
    let id = open(&mut c); paint(&mut c, id); review(&mut c, id, 85);
    let before = c.get_swarm().robots[SELLER].budget.0;
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(100 * MILLI), Some(plan()), Some(MB.parse().unwrap()));
    assert!(c.nft_is_approved("1".into(), MB.parse().unwrap(), Some(1)));
    let after = c.get_swarm().robots[SELLER].budget.0;
    assert!(before - after >= MARKET_STORAGE + APPRAISAL_FEE, "seller pays the market storage deposit");
}

#[test]
fn market_sale_pays_out_the_same_split() {
    let mut c = setup();
    approvals_on(&mut c);
    let id = open(&mut c); paint(&mut c, id); review(&mut c, id, 85);
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(100 * MILLI), None, Some(MB.parse().unwrap()));
    let budgets: Vec<u128> = c.get_swarm().robots.iter().map(|r| r.budget.0).collect();
    // Disallowed caller and wrong approval id fail.
    ctx(a("evil.testnet"), 1);
    assert!(panics(|| { c.nft_transfer_payout(buyer(), "1".into(), 1, None, U128(975 * MILLI / 10), Some(10)); }));
    ctx(a(MB), 1);
    assert!(panics(|| { c.nft_transfer_payout(buyer(), "1".into(), 7, None, U128(975 * MILLI / 10), Some(10)); }));
    ctx(a(MB), 1);
    let bal = 975 * MILLI / 10; // after Mintbase's 2.5% fee
    let p = c.nft_transfer_payout(buyer(), "1".into(), 1, None, U128(bal), Some(10));
    let sum: u128 = p.payout.values().map(|v| v.0).sum();
    assert_eq!(sum, bal, "payout must add up to the balance exactly");
    assert_eq!(p.payout[&owner()].0, bal * 2_000 / 10_000 + (bal - bal * 2_000 / 10_000 - [1_500u128, 3_500, 1_500, 1_500].iter().map(|b| bal * b / 10_000).sum::<u128>()));
    assert_eq!(c.nft_token("1".into()).unwrap().owner_id, buyer());
    let j = c.get_job(U64(id)).unwrap();
    assert_eq!(j.status, "sold");
    assert_eq!(j.buyer, Some(buyer()));
    let after: Vec<u128> = c.get_swarm().robots.iter().map(|r| r.budget.0).collect();
    assert_eq!(after[PAINTER] - budgets[PAINTER], bal * 3_500 / 10_000);
    assert!(get_logs().iter().any(|l| l.contains("\"venue\":\"market-v2-beta.mintspace2.testnet\"")));
    // Can't be sold twice.
    ctx(buyer(), 100 * MILLI);
    assert!(panics(|| { c.buy("1".into()); }));
}

#[test]
fn direct_buy_revokes_market_approval() {
    let mut c = setup();
    approvals_on(&mut c);
    let id = open(&mut c); paint(&mut c, id); review(&mut c, id, 85);
    ctx(seller(), 0);
    c.seller_list(U64(id), U128(100 * MILLI), None, Some(MB.parse().unwrap()));
    ctx(buyer(), 100 * MILLI);
    c.buy("1".into());
    assert!(!c.nft_is_approved("1".into(), MB.parse().unwrap(), None));
    ctx(a(MB), 1);
    assert!(panics(|| { c.nft_transfer_payout(a("b2.testnet"), "1".into(), 1, None, U128(MILLI), Some(10)); }));
}

#[test]
fn nft_payout_view_sums_to_balance() {
    let c = setup();
    let p = c.nft_payout("1".into(), U128(123_456_789), Some(10));
    assert_eq!(p.payout.values().map(|v| v.0).sum::<u128>(), 123_456_789);
}
