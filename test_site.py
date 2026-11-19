"""
Hellenic Subsidy Screener — Automated Zero-AI & E2E Test Suite
"""

import http.server
import re
import socketserver
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def log_message(self, format, *args):
        pass


def run_tests():
    print("[Test 1/6] Verifying Static Files, Zero-AI Lint & Strict CSP...")
    font_bytes = sum(f.stat().st_size for f in (DIST / "assets" / "fonts").glob("*.woff2"))
    assert 10000 < font_bytes <= 150000, f"Font payload budget exceeded: {font_bytes} B"

    index_html = (DIST / "index.html").read_text(encoding="utf-8")
    styles_css = (DIST / "styles.css").read_text(encoding="utf-8")
    for bad in ["cdn.tailwindcss.com", "unpkg.com", "fonts.googleapis.com", "unsafe-inline", "payhip.com", "29.00", "29€", "backdrop-blur", "hero-pill"]:
        assert bad not in index_html, f"Forbidden token in index.html: {bad}"
    assert not re.search(r'\sstyle="|\sonclick=|\sonchange=', index_html), "Inline style/handler forbidden under strict CSP!"
    assert "linear-gradient" not in styles_css, "Gradients forbidden in Zero-AI CSS"
    assert not EMOJI_RE.search(index_html), "Emojis forbidden in HTML UI!"
    assert "Ανεξάρτητο, Μη Επίσημο Εργαλείο" in index_html
    assert "FAQPage" in index_html and "Τελευταία ενημέρωση βάσης προσκλήσεων: 19/11/2026" in index_html
    assert "19 €" in index_html and "19.00" not in index_html
    for fname in ["privacy.html", "_headers", "sitemap.xml", "robots.txt", "googlecddcb0945a7b4e49.html"]:
        assert (DIST / fname).exists(), f"{fname} missing"
    assert "https://espa-screener-gr.pages.dev/" in (DIST / "sitemap.xml").read_text(encoding="utf-8")
    print(f"   -> PASS: Pure Light Screener, {font_bytes:,}B self-hosted WOFF2, strict CSP (0 unsafe-inline).")

    port = 8795
    class ReusableTCP(socketserver.TCPServer):
        allow_reuse_address = True

    httpd = ReusableTCP(("127.0.0.1", port), QuietHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    time.sleep(0.2)
    base_url = f"http://127.0.0.1:{port}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
            page = context.new_page()
            console_errs = []
            page.on("pageerror", lambda e: console_errs.append(str(e)))
            page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)

            external_requests = []
            page.on("request", lambda req: external_requests.append(req.url) if not req.url.startswith("http://127.0.0.1") and not req.url.startswith("data:") else None)

            print("[Test 2/6] Verifying Strict CSP, Self-Hosted Font & Zero Network Leaks...")
            page.goto(f"{base_url}/index.html", wait_until="networkidle")
            assert len(external_requests) == 0, f"External requests detected: {external_requests}"
            bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
            assert bg == "rgb(240, 243, 246)", f"Expected #F0F3F6 canvas bg, got {bg}"
            loaded_fonts = page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family)")
            assert any("IBM Plex Sans" in f for f in loaded_fonts), f"Self-hosted Plex not loaded: {loaded_fonts}"
            print(f"   -> PASS: 0 external leaks, loaded fonts={loaded_fonts}, bg={bg}.")

            print("[Test 3/6] Verifying Engine Accuracy, De Minimis Rolling 3Y & Mixed VAT Pro-Rata...")
            test_res = page.evaluate("""() => {
                const engine = window.EspaScreenerEngine;
                const p1 = engine.evaluateProfile({
                    stage: 'unregistered', founder_age: 'under_30', is_unemployed: true, has_asd: true,
                    has_degree_2016: true, personal_income: 'under_10k', sector: 'services_it',
                    eme: 0, autonomous_office: true, region: 'attica', investment_goal: 'startup_costs', de_minimis_received: 0
                });
                const p2 = engine.evaluateProfile({
                    stage: 'existing', founder_age: '30_to_59', is_unemployed: false, has_asd: false,
                    has_degree_2016: false, sector: 'services_it', eme: 2, autonomous_office: true,
                    region: 'attica', investment_goal: 'digital_software', de_minimis_received: 50000
                });
                const p3 = engine.evaluateProfile({ stage: 'existing', sector: 'services_it', eme: 2, de_minimis_received: 310000 });
                const rolling = engine.computeDeMinimisFromEntries([
                    { date: '2022-05-01', amount: 200000 },
                    { date: '2025-05-01', amount: 45000 }
                ], '2026-11-19');
                const bridge = engine.computeCashBridge(30000, 50, 24, 40);
                return {
                    p1_dypa: p1.programs.find(x => x.id === 'dypa_nees').status,
                    p1_xekino: p1.programs.find(x => x.id === 'espa_xekino').status,
                    p2_digital: p2.programs.find(x => x.id === 'espa_digital_basic').status,
                    p2_remain: p2.de_minimis.remaining,
                    p3_exceeded: p3.de_minimis.is_exceeded,
                    p3_eligible: p3.summary.eligible_count,
                    rolling_total: rolling.total3Yr,
                    rolling_excluded: rolling.excludedOlder,
                    bridge_liq: bridge.bridgeLiquidity,
                    bridge_nonrec: bridge.nonRecoverableVat,
                    md: engine.generateMarkdownReport(p1)
                };
            }""")
            assert test_res["p1_dypa"] == "eligible"
            assert test_res["p1_xekino"] == "eligible"
            assert test_res["p2_digital"] == "eligible"
            assert test_res["p2_remain"] == 250000
            assert test_res["p3_exceeded"] is True and test_res["p3_eligible"] == 0
            assert test_res["rolling_total"] == 45000 and test_res["rolling_excluded"] == 200000
            assert test_res["bridge_liq"] == 22200 and test_res["bridge_nonrec"] == 4320
            assert "Ενδεικτική Προ-Αξιολόγηση" in test_res["md"]
            assert not EMOJI_RE.search(test_res["md"]), "Emojis found in exported Markdown report!"
            print("   -> PASS: Engine calculations, rolling 3Y De Minimis, Pro-Rata VAT & Markdown verified.")

            print("[Test 4/6] Verifying Quick 10s Triage, 6-Step Wizard, Step 6 Pro-Rata/DM UI, Clear & Results...")
            assert page.locator("#quickTriagePanel").is_visible()
            page.select_option("#qtDeMinimis", "310000")
            assert "is-blocked" in (page.get_attribute("#quickTriageResult", "class") or "")
            page.select_option("#qtDeMinimis", "0")
            assert "is-ready" in (page.get_attribute("#quickTriageResult", "class") or "")
            page.click("#qtJumpResultsBtn")
            page.wait_for_selector("#results-pane:not(.is-hidden)")
            page.click("#btn-restart")
            page.wait_for_selector("#wizard-pane:not(.is-hidden)")

            for step in range(2, 7):
                page.click("#btn-next")
                assert page.is_visible(f"#step-{step}"), f"Did not reach Step {step}"
            page.fill("#dmDate1", "2025-05-01")
            page.fill("#dmAmt1", "20000")
            page.fill("#vatProRataInput", "40")
            assert "20.000" in page.inner_text("#dmRollingSummary")
            assert "4.320" in page.inner_text("#cashBridgeWizardPreview")
            assert page.evaluate("localStorage.getItem('cl_p6_v1')") is not None

            page.click("#btn-next")
            page.wait_for_selector("#results-pane:not(.is-hidden)")
            assert "4.320" in page.inner_text("#cashBridgeSummaryRow")
            assert "ΔΥΝΗΤΙΚΑ ΣΥΜΒΑΤΟ (ΠΡΟ-ΑΞΙΟΛΟΓΗΣΗ)" in page.inner_text("#resultsTableBody")
            assert "19/11/2026" in page.inner_text("#resultsTableBody")
            assert int(page.inner_text("#stat-eligible-count")) >= 1
            assert len(page.locator("#resultsTableBody tr").all()) >= 5
            assert len(page.locator(".program-card").all()) >= 5
            assert not EMOJI_RE.search(page.inner_text("body")), "Emojis rendered in DOM results!"
            assert ".style." not in (DIST / "app.js").read_text(encoding="utf-8"), "Forbidden .style. DOM mutation in app.js"
            print("   -> PASS: 6-step wizard, Pro-Rata cash bridge, rolling 3Y DM, verification dates & 0 .style. verified.")

            print("[Test 5/6] Verifying Static GDPR Waitlist Guard, Advice Selector, Clear & Clipboard Copy...")
            assert page.locator("#proWaitlistAdvice").count() == 1
            assert not page.is_checked("#proWaitlistConsent"), "Consent checkbox must start unchecked"
            page.fill("#proWaitlistEmail", "test@company.gr")
            page.click("#proWaitlistBtn")
            page.wait_for_timeout(150)
            assert "err" in (page.get_attribute("#proWaitlistStatus", "class") or "")
            assert len(external_requests) == 0, f"Leak without consent: {external_requests}"

            page.click("#btn-copy-report")
            page.wait_for_timeout(200)
            assert "Αντιγράφηκε" in page.inner_text("#btn-copy-report")
            print("   -> PASS: Static GDPR Waitlist guard & Markdown copy verified.")

            print("[Test 6/6] Verifying Mobile 390px & 320px Zero Horizontal Overflow & Data Clear...")
            for width in (390, 320):
                page.set_viewport_size({"width": width, "height": 844})
                page.wait_for_timeout(150)
                diff = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                assert diff <= 0, f"Overflow on results @ {width}px: {diff}px"
            page.click("#btn-restart")
            page.wait_for_timeout(150)
            for s in range(1, 7):
                diff = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                assert diff <= 0, f"Overflow on step {s} @ 320px: {diff}px"
                if s < 6:
                    page.click("#btn-next")
                    page.wait_for_timeout(100)
            page.click("#btnClearP6")
            page.wait_for_timeout(120)
            assert page.evaluate("localStorage.getItem('cl_p6_v1')") is None, "Clear did not remove cl_p6_v1"
            assert not console_errs, f"Console/CSP errors detected: {console_errs}"
            print("   -> PASS: 390px & 320px clean across results + all 6 steps (0px overflow, clear verified, 0 CSP errors).")

            browser.close()
    finally:
        httpd.shutdown()

    print("\nALL 6 P6 ZERO-AI SCREENER TEST SUITES PASSED!")


if __name__ == "__main__":
    run_tests()
