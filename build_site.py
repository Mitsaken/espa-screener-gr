"""
Hellenic Subsidy Screener — Static Site Generator
Zero External CDN, Self-Hosted WOFF2 Font, Strict CSP (0 unsafe-inline), 100% Client-Side
"""

import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"

CONFIG = json.loads((ROOT / "site_config.json").read_text(encoding="utf-8"))
SITE_URL = CONFIG["SITE_URL"]
WAITLIST_ORIGIN = "https://conversionlogic-waitlist.conversionlogic.workers.dev"
GOOGLE_VERIFY = "cddcb0945a7b4e49"

CSP_POLICY = (
    "default-src 'self'; "
    "font-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data:; "
    f"connect-src 'self' {WAITLIST_ORIGIN}; "
    f"form-action 'self' {WAITLIST_ORIGIN};"
)


def clean_and_prep_dist():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True, exist_ok=True)


def transform_html(raw_html: str) -> str:
    csp_meta = f'<meta http-equiv="Content-Security-Policy" content="{CSP_POLICY}">'
    gsc_meta = f'<meta name="google-site-verification" content="{GOOGLE_VERIFY}">'
    canonical_link = f'<link rel="canonical" href="{SITE_URL}/">'
    tw_meta = (
        '<meta name="twitter:card" content="summary">\n'
        '  <meta name="twitter:title" content="Hellenic Subsidy Screener — Προέλεγχος ΕΣΠΑ & ΔΥΠΑ">\n'
        '  <meta name="twitter:description" content="Αλγοριθμικός προέλεγχος επιλεξιμότητας ΕΣΠΑ 2021-2027, ΔΥΠΑ, ΚΑΔ, ΕΜΕ, ΦΠΑ Pro-Rata & De Minimis 300.000 €.">\n'
        '  <meta property="article:modified_time" content="2026-11-19">'
    )
    ld_obj = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "name": "Hellenic Subsidy Screener — Προέλεγχος ΕΣΠΑ 2021-2027 & ΔΥΠΑ",
                "operatingSystem": "All modern browsers",
                "applicationCategory": "BusinessApplication",
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
                "author": {"@type": "Organization", "name": "Conversionlogic"},
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": "Ποιο είναι το όριο σώρευσης De Minimis (Καν. ΕΕ 2023/2831);",
                        "acceptedAnswer": {"@type": "Answer", "text": "Βάσει του Κανονισμού (ΕΕ) 2023/2831, το γενικό ανώτατο όριο ενισχύσεων ήσσονος σημασίας ανέρχεται στις 300.000 € ανά ενιαία επιχείρηση σε οποιαδήποτε κυλιόμενη περίοδο 3 ετών."},
                    },
                    {
                        "@type": "Question",
                        "name": "Επιτρέπεται η χρήση κατοικίας ως επαγγελματικής έδρας;",
                        "acceptedAnswer": {"@type": "Answer", "text": "Στη μεγάλη πλειονότητα των προσκλήσεων ΕΣΠΑ απαιτείται αυτόνομος επαγγελματικός χώρος με καταχωρημένο μισθωτήριο Taxisnet. Η συστέγαση ή έδρα κατοικίας συνήθως αποκλείεται."},
                    },
                    {
                        "@type": "Question",
                        "name": "Πώς υπολογίζονται οι Ετήσιες Μονάδες Εργασίας (ΕΜΕ);",
                        "acceptedAnswer": {"@type": "Answer", "text": "Μία ΕΜΕ ισοδυναμεί με έναν εργαζόμενο πλήρους απασχόλησης καθ' όλο το έτος (~300 ημέρες ασφάλισης). Δύο εργαζόμενοι 4ωρης απασχόλησης αντιστοιχούν σε 1 ΕΜΕ."},
                    },
                    {
                        "@type": "Question",
                        "name": "Ποια είναι η διαφορά μεταξύ επιδότησης ΔΥΠΑ και ΕΣΠΑ;",
                        "acceptedAnswer": {"@type": "Answer", "text": "Οι δράσεις ΔΥΠΑ απευθύνονται σε εγγεγραμμένους ανέργους με κατ' αποκοπή δόσεις για λειτουργικά έξοδα, ενώ οι προσκλήσεις ΕΣΠΑ επιδοτούν τιμολόγια επενδυτικών σχεδίων μέσω ΟΠΣΚΕ."},
                    },
                ],
            },
        ],
    }
    json_ld_script = '<script type="application/ld+json">\n' + json.dumps(ld_obj, ensure_ascii=False, indent=2) + "\n  </script>"
    head_insert = f"\n  {csp_meta}\n  {gsc_meta}\n  {canonical_link}\n  {tw_meta}\n  {json_ld_script}"
    return raw_html.replace("<head>", f"<head>{head_insert}", 1)


def generate_privacy_html():
    privacy_html = f"""<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="{CSP_POLICY}">
  <meta name="google-site-verification" content="{GOOGLE_VERIFY}">
  <link rel="canonical" href="{SITE_URL}/privacy.html">
  <title>Πολιτική Απορρήτου &amp; Νομική Ενημέρωση — Hellenic Subsidy Screener</title>
  <meta name="description" content="Πολιτική απορρήτου GDPR, καθεστώς 0€ Validation Mode και ανεξάρτητη νομική αποποίηση ευθύνης για το Hellenic Subsidy Screener.">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="masthead">
    <div class="container masthead-inner">
      <a href="./" class="brand-area">
        <div class="brand-kicker">CONVERSIONLOGIC · GRANT ELIGIBILITY ASSESSMENT DESK</div>
        <h1 class="brand-title">Hellenic Subsidy Screener</h1>
        <p class="brand-sub">Αλγοριθμικός Προέλεγχος ΕΣΠΑ 2021–2027 &amp; ΔΥΠΑ</p>
      </a>
    </div>
  </header>

  <main class="container main-wrap">
    <article class="legal-card">
      <a href="./" class="legal-back">&larr; Επιστροφή στον Έλεγχο Επιλεξιμότητας</a>
      <h1>Πολιτική Απορρήτου (GDPR) &amp; Νομική Ενημέρωση</h1>
      <p><strong>Τελευταίος Τεχνικός/Νομικός Έλεγχος:</strong> 19/11/2026</p>

      <h2>1. Ανεξάρτητο, Μη Επίσημο Εργαλείο</h2>
      <p>Το <strong>Hellenic Subsidy Screener</strong> αποτελεί ανεξάρτητη τεχνική πρωτοβουλία. <strong>Δεν συνδέεται, δεν χρηματοδοτείται, δεν υποστηρίζεται και δεν εγκρίνεται</strong> από το Υπουργείο Εθνικής Οικονομίας &amp; Οικονομικών, την ΕΥΔ/ΕΣΠΑ, το ΟΠΣΚΕ ή τη ΔΥΠΑ.</p>

      <h2>2. Καθεστώς Λειτουργίας — 0€ Validation Mode</h2>
      <p>Ο ιστότοπος λειτουργεί ως ανοιχτό εργαλείο προελέγχου και έρευνας ενδιαφέροντος (0€ Validation Mode). Δεν πραγματοποιούνται πωλήσεις, τιμολογήσεις ή συνδρομητικές χρεώσεις.</p>

      <h2>3. Τοπική Εκτέλεση Υπολογισμών</h2>
      <p>Όλα τα στοιχεία που εισάγετε (ΚΑΔ, ΕΜΕ, De Minimis, περιφέρεια, ηλικία/ιδιότητα ιδρυτή, Pro-Rata ΦΠΑ) αξιολογούνται τοπικά στον browser σας (προαιρετική αποθήκευση προσχεδίου μόνο στη συσκευή σας στο <code>cl_p6_v1</code> κατόπιν δικής σας τροποποίησης, διαγράψιμη άμεσα με «Καθαρισμός Δεδομένων»). Δεν χρησιμοποιούνται cookies παρακολούθησης ή εξωτερικές γραμματοσειρές/CDNs.</p>

      <h2>4. Λίστα Προτεραιότητας &amp; Συμμόρφωση GDPR</h2>
      <ul>
        <li>Η υποβολή email στη Λίστα Αναμονής (Waitlist) είναι προαιρετική και ενεργοποιείται μόνο κατόπιν ρητής θετικής συγκατάθεσης.</li>
        <li>Τα στοιχεία χρησιμοποιούνται αποκλειστικά για μία ειδοποίηση διαθεσιμότητας, με δικαίωμα διαγραφής οποτεδήποτε.</li>
      </ul>

      <h2>5. Αποποίηση Ευθύνης</h2>
      <p>Τα αποτελέσματα βασίζονται σε δημόσιες προσκλήσεις ΕΣΠΑ 2021–2027, ΔΥΠΑ και Καν. (ΕΕ) 2023/2831 (De Minimis). Δεν υποκαθιστούν επίσημη κρίση ΟΠΣΚΕ ούτε τους όρους της εκάστοτε επίσημης προκήρυξης.</p>
    </article>
  </main>
</body>
</html>
"""
    (DIST / "privacy.html").write_text(privacy_html.strip(), encoding="utf-8")


def generate_headers():
    headers = """/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
"""
    (DIST / "_headers").write_text(headers, encoding="utf-8")


def generate_sitemap():
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{SITE_URL}/</loc>
    <lastmod>2026-11-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>{SITE_URL}/privacy.html</loc>
    <lastmod>2026-11-19</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
"""
    (DIST / "sitemap.xml").write_text(sitemap.strip(), encoding="utf-8")


def generate_robots():
    robots = f"""User-agent: *
Allow: /

Sitemap: {SITE_URL}/sitemap.xml
"""
    (DIST / "robots.txt").write_text(robots.strip(), encoding="utf-8")


def generate_google_verify():
    filename = f"google{GOOGLE_VERIFY}.html"
    (DIST / filename).write_text(f"google-site-verification: {filename}", encoding="utf-8")


def build():
    print("Building Hellenic Subsidy Screener Zero-AI Edition...")
    clean_and_prep_dist()

    raw_html = (ROOT / "index_template.html").read_text(encoding="utf-8")
    (DIST / "index.html").write_text(transform_html(raw_html), encoding="utf-8")

    shutil.copy2(ROOT / "styles.css", DIST / "styles.css")
    shutil.copy2(ROOT / "engine.js", DIST / "engine.js")
    shutil.copy2(ROOT / "app.js", DIST / "app.js")
    shutil.copytree(ROOT / "assets", DIST / "assets")

    generate_privacy_html()
    generate_headers()
    generate_sitemap()
    generate_robots()
    generate_google_verify()

    zip_path = ROOT / "site.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(DIST.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(DIST).as_posix())
    print(f"Created deployable Cloudflare ZIP: {zip_path.name} ({zip_path.stat().st_size:,} bytes)")
    print("Build Complete!")


if __name__ == "__main__":
    build()
