/**
 * Hellenic Subsidy & NSRF/ΕΣΠΑ Screener 2026 — Core Evaluation Engine
 * Conversionlogic Epistemic Architecture | Zero External CDNs | Client-Side First
 * 
 * Statutory References & Official Frameworks:
 * - Regulation (EU) 2023/2831 (De Minimis Rule: 300,000 € rolling 3-year ceiling from 01/01/2024 to 31/12/2030)
 * - Greek NSRF / ΕΣΠΑ 2021–2027 Operational Programme "Competitiveness" (Ανταγωνιστικότητα)
 * - DYPA Employment & Self-Employment Framework (14,800 € - 17,500 € lump sum)
 * - OPSKE (Integrated State Aid Information System - app.opske.gr)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EspaScreenerEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Constants
  var DE_MINIMIS_LIMIT_2026 = 300000; // Reg. (EU) 2023/2831
  var MAX_DEGREE_INCOME_LIMIT = 30000; // ΕΣΠΑ Πτυχιούχοι όριο εισοδήματος
  var DEFAULT_VERIFIED_DATE = '19/11/2026';

  function safeNum(val, fallback) {
    var n = Number(val);
    return Number.isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
  }

  function roundCents(val) {
    return Math.round((safeNum(val, 0) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Computes rolling 3-year De Minimis utilization under Reg. (EU) 2023/2831.
   * Includes grants whose date is >= (refDate - 3 years) and <= refDate.
   */
  function computeDeMinimisFromEntries(entries, refIso) {
    var list = Array.isArray(entries) ? entries : [];
    var refStr = refIso || '2026-11-19';
    var refMs = Date.parse(refStr + 'T23:59:59Z');
    var refDate = Number.isFinite(refMs) ? new Date(refMs) : new Date('2026-11-19T23:59:59Z');
    var cutoffDate = new Date(Date.UTC(refDate.getUTCFullYear() - 3, refDate.getUTCMonth(), refDate.getUTCDate()));
    var total3Yr = 0;
    var excludedOlder = 0;
    var activeCount = 0;

    list.forEach(function (row) {
      if (!row) return;
      var amt = Math.max(0, safeNum(row.amount, 0));
      if (amt <= 0) return;
      var dtStr = (row.date || '').trim();
      var dtMs = dtStr ? Date.parse(dtStr + 'T00:00:00Z') : refDate.getTime();
      if (!Number.isFinite(dtMs)) dtMs = refDate.getTime();
      if (dtMs >= cutoffDate.getTime() && dtMs <= refDate.getTime()) {
        total3Yr = roundCents(total3Yr + amt);
        activeCount++;
      } else if (dtMs < cutoffDate.getTime()) {
        excludedOlder = roundCents(excludedOlder + amt);
      }
    });

    return {
      total3Yr: total3Yr,
      excludedOlder: excludedOlder,
      activeCount: activeCount,
      cutoffIso: cutoffDate.toISOString().slice(0, 10)
    };
  }

  /**
   * Liquidity Bridge & Mixed VAT (Pro-Rata %) Calculator:
   * Standard VAT SME (proRata = 100%) reclaims input VAT later but still bridges it upfront.
   * Mixed/Exempt VAT SME (proRata < 100%) bears non-recoverable VAT = VAT * (1 - proRata/100) permanently.
   */
  function computeCashBridge(capexEur, grantRatePct, vatRatePct, vatProRataPct) {
    var capex = Math.max(0, safeNum(capexEur, 30000));
    var rate = Math.min(100, Math.max(0, safeNum(grantRatePct, 50)));
    var vatPct = Math.min(100, Math.max(0, safeNum(vatRatePct, 24)));
    var proRata = Math.min(100, Math.max(0, safeNum(vatProRataPct, 100)));

    var grantAmount = roundCents(capex * (rate / 100));
    var ownEquity = roundCents(capex - grantAmount);
    var vatTotal = roundCents(capex * (vatPct / 100));
    var recoverableVat = roundCents(vatTotal * (proRata / 100));
    var nonRecoverableVat = roundCents(vatTotal - recoverableVat);
    var bridgeLiquidity = roundCents(ownEquity + vatTotal);
    var netPermanentCost = roundCents(ownEquity + nonRecoverableVat);

    return {
      capex: capex,
      grantRatePct: rate,
      vatRatePct: vatPct,
      vatProRataPct: proRata,
      grantAmount: grantAmount,
      ownEquity: ownEquity,
      vatTotal: vatTotal,
      recoverableVat: recoverableVat,
      nonRecoverableVat: nonRecoverableVat,
      bridgeLiquidity: bridgeLiquidity,
      netPermanentCost: netPermanentCost
    };
  }

  var PROGRAMS_DB = [
    {
      id: 'dypa_nees',
      name: 'ΔΥΠΑ: Πρόγραμμα Νέας Επιχειρηματικότητας Ανέργων',
      category: 'Αυτοαπασχόληση & Ίδρυση',
      managing_authority: 'Δημόσια Υπηρεσία Απασχόλησης (ΔΥΠΑ)',
      official_law: 'Υ.Α. 3928/2026 (ΦΕΚ Β΄ 729/12.02.2026)',
      cycle_status: 'Αναμενόμενος Νέος Κύκλος 2026–27',
      cycle_badge_color: 'amber',
      max_grant_amount: 17500,
      grant_ceiling_str: '14.800 € – 17.500 €',
      subsidy_rate: '100% (Κατ\' αποκοπή / Lump Sum σε 3 δόσεις)',
      funding_system: 'Lump Sum (1η: 4.700€, 2η: 6.400€, 3η: 6.400€)',
      portal: 'dypa.gov.gr / opske.gr',
      short_desc: 'Ενίσχυση ίδρυσης νέων επιχειρήσεων από ανέργους 18–29 (NEETs) και 30–59, με 100% επιχορήγηση 12μηνης διάρκειας.',
      eligible_stages: ['unregistered'],
      min_eme: 0,
      requires_unemployed: true,
      requires_asd: true,
      requires_military_ok: true,
      requires_degree_2016: false,
      max_income: null,
      prohibits_home_office: false,
      allowed_sectors: ['services_it', 'retail_wholesale', 'tourism_hospitality', 'manufacturing_craft', 'consulting_engineering'],
      restricted_sectors: ['gambling', 'nightlife', 'tobacco'],
      de_minimis_bound: true,
      prep_guide_section: 'dypa_startup_prep'
    },
    {
      id: 'espa_xekino',
      name: 'ΕΣΠΑ: «Ξεκινώ Επιχειρηματικά» (Πτυχιούχοι Τριτοβάθμιας)',
      category: 'Επιστημονική & Νεανική Ίδρυση',
      managing_authority: 'ΕΥΔ Προγράμματος «Ανταγωνιστικότητα» / ΕΦΕΠΑΕ',
      official_law: 'ΕΣΠΑ 2021-2027 (Πρόσκληση ΕΦΕΠΑΕ)',
      cycle_status: 'Προετοιμασία Φακέλου για Νέο Κύκλο',
      cycle_badge_color: 'blue',
      max_grant_amount: 36000,
      grant_ceiling_str: '13.000 € – 36.000 €',
      subsidy_rate: '100% (Απλοποιημένο κόστος / Unit costs)',
      funding_system: '13k€ ατομική / 21k€ εταιρεία + 15k€ για 1 νέα θέση εργασίας',
      portal: 'opske.gr',
      short_desc: '100% επιδότηση για ίδρυση ατομικής ή εταιρικής επιχείρησης από πτυχιούχους ΑΕΙ/ΤΕΙ με έδρα σε αυτόνομο χώρο.',
      eligible_stages: ['unregistered', 'newborn'],
      min_eme: 0,
      requires_unemployed: false,
      requires_asd: false,
      requires_military_ok: true,
      requires_degree_2016: true,
      max_income: 30000,
      prohibits_home_office: true,
      allowed_sectors: ['services_it', 'consulting_engineering', 'manufacturing_craft', 'tourism_hospitality'],
      restricted_sectors: ['gambling', 'nightlife', 'retail_generic'],
      de_minimis_bound: true,
      prep_guide_section: 'espa_graduates_prep'
    },
    {
      id: 'espa_digital_basic',
      name: 'ΕΣΠΑ: «Βασικός Ψηφιακός Μετασχηματισμός ΜμΕ»',
      category: 'Ψηφιακός Εκσυγχρονισμός',
      managing_authority: 'ΕΥΔ Προγράμματος «Ανταγωνιστικότητα»',
      official_law: 'Πρόγραμμα «Ανταγωνιστικότητα» ΕΣΠΑ 2021–2027',
      cycle_status: 'Ενεργές Προσκλήσεις & Περιφερειακά ΠΕΠ',
      cycle_badge_color: 'emerald',
      max_grant_amount: 18000, // 60% of 30.000
      grant_ceiling_str: '9.000 € – 18.000 € (Επένδυση 18k€–30k€)',
      subsidy_rate: '50% – 60% (ανάλογα με την περιφέρεια)',
      funding_system: 'Απολογιστική συγχρηματοδότηση τιμολογίων & εξοπλισμού',
      portal: 'opske.gr',
      short_desc: 'Χρηματοδότηση για e-shop, ERP/CRM συστήματα, laptops/workstations, cloud servers & κυβερνοασφάλεια.',
      eligible_stages: ['existing'],
      min_eme: 1.0,
      requires_unemployed: false,
      requires_asd: false,
      requires_military_ok: false,
      requires_degree_2016: false,
      max_income: null,
      prohibits_home_office: false,
      allowed_sectors: ['services_it', 'retail_wholesale', 'tourism_hospitality', 'manufacturing_craft', 'consulting_engineering', 'food_dining'],
      restricted_sectors: ['gambling'],
      de_minimis_bound: true,
      prep_guide_section: 'digital_transformation_prep'
    },
    {
      id: 'espa_digital_advanced',
      name: 'ΕΣΠΑ: «Προηγμένος / Εξελιγμένος Ψηφιακός Μετασχηματισμός»',
      category: 'Deep Tech & Αυτοματισμός',
      managing_authority: 'ΕΥΔ Προγράμματος «Ανταγωνιστικότητα»',
      official_law: 'ΕΣΠΑ 2021-2027 Κρατικές Ενισχύσεις',
      cycle_status: 'Συνεχής Υποβολή / Ανοιχτή Δράση',
      cycle_badge_color: 'emerald',
      max_grant_amount: 250000, // 50% of 500k
      grant_ceiling_str: '25.000 € – 325.000 € (Επένδυση 50k€–650k€)',
      subsidy_rate: '25% – 50%',
      funding_system: 'Τμηματική καταβολή με ενδιάμεσες πιστοποιήσεις υλοποίησης',
      portal: 'opske.gr',
      short_desc: 'Επενδύσεις σε Cloud AI, Data Lakes, IoT sensors, Industry 4.0 ρομποτική & automated warehouse WMS.',
      eligible_stages: ['existing'],
      min_eme: 3.0,
      requires_unemployed: false,
      requires_asd: false,
      requires_military_ok: false,
      requires_degree_2016: false,
      max_income: null,
      prohibits_home_office: false,
      allowed_sectors: ['services_it', 'manufacturing_craft', 'retail_wholesale', 'tourism_hospitality'],
      restricted_sectors: [],
      de_minimis_bound: true,
      prep_guide_section: 'digital_advanced_prep'
    },
    {
      id: 'espa_green_transition',
      name: 'ΕΣΠΑ: «Πράσινος Μετασχηματισμός & Κυκλική Οικονομία»',
      category: 'Ενέργεια & Βιωσιμότητα',
      managing_authority: 'ΕΥΔ Προγράμματος «Ανταγωνιστικότητα»',
      official_law: 'Πράσινη Μετάβαση ΜμΕ ΕΣΠΑ 2021-2027',
      cycle_status: 'Ανοιχτό / Τρέχοντα Περιφερειακά Προγράμματα',
      cycle_badge_color: 'emerald',
      max_grant_amount: 100000, // 50% of 200k
      grant_ceiling_str: '15.000 € – 100.000 € (Επένδυση 30k€–200k€)',
      subsidy_rate: '40% – 50%',
      funding_system: 'Επιδότηση δαπανών εξοπλισμού, πιστοποιήσεων & Net Billing',
      portal: 'opske.gr',
      short_desc: 'Επιδότηση για φωτοβολταϊκά αυτοπαραγωγής, αντικατάσταση ενεργοβόρου εξοπλισμού, ηλεκτρικά βαν & ISO 14001.',
      eligible_stages: ['existing'],
      min_eme: 2.0,
      requires_unemployed: false,
      requires_asd: false,
      requires_military_ok: false,
      requires_degree_2016: false,
      max_income: null,
      prohibits_home_office: false,
      allowed_sectors: ['manufacturing_craft', 'tourism_hospitality', 'retail_wholesale', 'services_it', 'food_dining'],
      restricted_sectors: [],
      de_minimis_bound: true,
      prep_guide_section: 'green_transition_prep'
    },
    {
      id: 'ypen_exoikonomo_biz',
      name: 'ΥΠΕΝ / Ταμείο Ανάκαμψης: «Εξοικονομώ - Επιχειρώ»',
      category: 'Ενεργειακή Αναβάθμιση Κτιρίων',
      managing_authority: 'Υπουργείο Περιβάλλοντος & Ενέργειας / ΤΑΑ',
      official_law: 'Πρόγραμμα «Εξοικονομώ - Επιχειρώ» (Ελλάδα 2.0)',
      cycle_status: 'Ενεργό (Έως εξαντλήσεως προϋπολογισμού)',
      cycle_badge_color: 'emerald',
      max_grant_amount: 50000, // 50% of 100k (retail/services) or 250k (tourism)
      grant_ceiling_str: '20.000 € – 250.000 € (Επένδυση έως 100k€/500k€)',
      subsidy_rate: '40% – 65% (+15% bonus μικρής επιχείρησης)',
      funding_system: 'Πιστοποίηση από Ενεργειακό Επιθεωρητή (ΠΕΑ) προ & μετά',
      portal: 'exoikonomoepixeiro.ypen.gr',
      short_desc: 'Θερμομόνωση κτιρίου, αντλίες θερμότητας, κλιματισμός VRV, ενεργειακά κουφώματα, LED & BACS αυτοματισμοί.',
      eligible_stages: ['existing'],
      min_eme: 0.5,
      requires_unemployed: false,
      requires_asd: false,
      requires_military_ok: false,
      requires_degree_2016: false,
      max_income: null,
      prohibits_home_office: true, // Requires commercial premises with electricity meter
      allowed_sectors: ['retail_wholesale', 'tourism_hospitality', 'services_it', 'food_dining', 'manufacturing_craft'],
      restricted_sectors: [],
      de_minimis_bound: true,
      prep_guide_section: 'exoikonomo_prep'
    },
    {
      id: 'leader_rural',
      name: 'Προγράμματα LEADER (ΣΣ ΚΑΠ 2023–2027)',
      category: 'Περιφερειακή & Αγροτική Ανάπτυξη',
      managing_authority: 'Τοπικές Ομάδες Δράσης (ΟΤΔ) ανά Περιφέρεια',
      official_law: 'Στρατηγικό Σχέδιο ΚΑΠ 2023-2027 (Παρεμβάσεις LEADER)',
      cycle_status: 'Ενεργές Τοπικές Προσκλήσεις ανά Νομό',
      cycle_badge_color: 'emerald',
      max_grant_amount: 150000,
      grant_ceiling_str: '20.000 € – 150.000 € (Επένδυση έως 300.000 €)',
      subsidy_rate: '50% – 80% (το υψηλότερο ποσοστό στο ελληνικό σύστημα)',
      funding_system: 'Τοπικές προσκλήσεις ΟΤΔ με συγκριτική βαθμολόγηση',
      portal: 'agrotikianaptixi.gr / Τοπικές ΟΤΔ',
      short_desc: 'Ενίσχυση βιοτεχνιών, αγροτουριστικών καταλυμάτων, μεταποίησης & υπηρεσιών σε χαρακτηρισμένες αγροτικές περιοχές.',
      eligible_stages: ['unregistered', 'newborn', 'existing'],
      min_eme: 0,
      requires_unemployed: false,
      requires_asd: false,
      requires_military_ok: false,
      requires_degree_2016: false,
      max_income: null,
      prohibits_home_office: false,
      allowed_sectors: ['manufacturing_craft', 'tourism_hospitality', 'services_it', 'food_dining'],
      restricted_sectors: ['gambling'],
      de_minimis_bound: true,
      prep_guide_section: 'leader_rural_prep'
    }
  ];

  /**
   * Evaluates the profile against all programs in the database.
   * @param {Object} profile 
   * @returns {Object} Evaluation report containing matches, scores, disqualifiers, and action plans.
   */
  function evaluateProfile(profile) {
    var hasEntries = Array.isArray(profile.de_minimis_entries) && profile.de_minimis_entries.some(function (r) {
      return r && safeNum(r.amount, 0) > 0;
    });
    var rollingSummary = computeDeMinimisFromEntries(profile.de_minimis_entries || []);
    var deMinimisReceived = hasEntries
      ? rollingSummary.total3Yr
      : Math.max(0, safeNum(profile.de_minimis_received, 0));
    var deMinimisExceeded = deMinimisReceived >= DE_MINIMIS_LIMIT_2026;
    var deMinimisRemaining = Math.max(0, roundCents(DE_MINIMIS_LIMIT_2026 - deMinimisReceived));
    var cashBridge = computeCashBridge(
      profile.capex_eur !== undefined ? profile.capex_eur : 30000,
      profile.subsidy_pct !== undefined ? profile.subsidy_pct : 50,
      24,
      profile.vat_pro_rata_pct !== undefined ? profile.vat_pro_rata_pct : 100
    );

    var evaluatedPrograms = [];
    var totalPotentialGrant = 0;
    var eligibleCount = 0;
    var conditionalCount = 0;

    PROGRAMS_DB.forEach(function (prog) {
      var score = 100;
      var passReasons = [];
      var failReasons = [];
      var nextSteps = [];
      var status = 'eligible'; // 'eligible', 'conditional', 'ineligible'

      // Check 1: De Minimis Rule (Reg. EU 2023/2831)
      if (prog.de_minimis_bound) {
        if (deMinimisExceeded) {
          score = 0;
          status = 'ineligible';
          failReasons.push('Υπέρβαση ανώτατου ορίου κρατικών ενισχύσεων De Minimis (300.000 € στην 3ετία).');
        } else if (deMinimisRemaining < 15000) {
          score -= 30;
          if (status !== 'ineligible') status = 'conditional';
          failReasons.push('Περιορισμένο υπόλοιπο De Minimis (' + deMinimisRemaining.toLocaleString('el-GR') + ' € διαθέσιμα).');
        } else {
          passReasons.push('Πλήρης συμβατότητα με το όριο De Minimis (Διαθέσιμο περιθώριο: ' + deMinimisRemaining.toLocaleString('el-GR') + ' €).');
        }
      }

      // Check 2: Business Lifecycle Stage
      if (prog.eligible_stages.indexOf(profile.stage) === -1) {
        score = 0;
        status = 'ineligible';
        if (profile.stage === 'existing') {
          failReasons.push('Το πρόγραμμα απευθύνεται αποκλειστικά σε υπό ίδρυση ή νεοσύστατες επιχειρήσεις (όχι υφιστάμενες >1 έτος).');
        } else if (profile.stage === 'unregistered' || profile.stage === 'newborn') {
          failReasons.push('Το πρόγραμμα απαιτεί υφιστάμενη λειτουργία τουλάχιστον 1 έτους με κλεισμένη διαχειριστική χρήση.');
        }
      } else {
        passReasons.push('Το στάδιο της επιχείρησής σας (' + getStageLabel(profile.stage) + ') είναι 100% επιλέξιμο.');
      }

      // Check 3: Staffing & EME (Ετήσιες Μονάδες Εργασίας)
      var userEme = parseFloat(profile.eme || 0);
      if (prog.min_eme > 0) {
        if (userEme < prog.min_eme) {
          score -= 40;
          if (status !== 'ineligible') status = 'conditional';
          failReasons.push('Απαιτείται τουλάχιστον ' + prog.min_eme + ' ΕΜΕ προσωπικού (Δηλωμένες: ' + userEme + ' ΕΜΕ).');
          nextSteps.push('Προγραμματισμός νέας πρόσληψης ή αύξηση ωραρίου προσωπικού για κάλυψη του ορίου ΕΜΕ.');
        } else {
          passReasons.push('Καλύπτεται το κριτήριο απασχόλησης (Δηλωμένες: ' + userEme + ' ΕΜΕ ≥ ' + prog.min_eme + ' απαιτούμενες).');
        }
      }

      // Check 4: Unemployment & DYPA Registry (For Startup Programs)
      if (prog.requires_unemployed) {
        if (!profile.is_unemployed) {
          score = 0;
          status = 'ineligible';
          failReasons.push('Απαιτείται ενεργή κάρτα ανεργίας στο ψηφιακό μητρώο της ΔΥΠΑ πριν από την ίδρυση.');
        } else {
          passReasons.push('Επιβεβαιωμένη εγγραφή στο ψηφιακό μητρώο ανέργων ΔΥΠΑ.');
          if (!profile.has_asd) {
            score -= 15;
            if (status === 'eligible') status = 'conditional';
            failReasons.push('Εκκρεμεί η σύνταξη Ψηφιακού Ατομικού Σχεδίου Δράσης (ΑΣΔ) με εργασιακό σύμβουλο ΔΥΠΑ.');
            nextSteps.push('Κλείσιμο ραντεβού με σύμβουλο ΔΥΠΑ μέσω gov.gr για άμεση οριστικοποίηση του Ψηφιακού ΑΣΔ.');
          } else {
            passReasons.push('Ολοκληρωμένο Ψηφιακό Ατομικό Σχέδιο Δράσης (ΑΣΔ).');
          }
        }
      }

      // Check 5: Academic Degree (ΕΣΠΑ Πτυχιούχοι)
      if (prog.requires_degree_2016) {
        if (!profile.has_degree_2016) {
          score = 0;
          status = 'ineligible';
          failReasons.push('Απαιτείται τίτλος σπουδών ΑΕΙ/ΤΕΙ με ημερομηνία κτήσης από 01/01/2016 και μετά.');
        } else {
          passReasons.push('Κτήση πτυχίου ΑΕΙ/ΤΕΙ μετά το 2016 (Επιλέξιμος πτυχιούχος).');
        }

        // Income threshold check for degree program
        var incomeVal = profile.personal_income || 'under_10k';
        if (incomeVal === 'over_30k') {
          score = 0;
          status = 'ineligible';
          failReasons.push('Υπέρβαση ορίου ατομικού εισοδήματος (απαιτείται ετήσιο εισόδημα ≤ 30.000 €).');
        } else {
          passReasons.push('Ατομικό εισόδημα εντός του προβλεπόμενου ορίου (≤ 30.000 €).');
        }
      }

      // Check 6: Military Obligations (for male applicants where required)
      if (prog.requires_military_ok && profile.gender === 'male') {
        if (!profile.military_cleared) {
          score = 0;
          status = 'ineligible';
          failReasons.push('Εκκρεμούν οι στρατιωτικές υποχρεώσεις (απαιτείται απόλυση ή νόμιμη απαλλαγή).');
        } else {
          passReasons.push('Εκπληρωμένες ή νόμιμα απαλλαγμένες στρατιωτικές υποχρεώσεις.');
        }
      }

      // Check 7: Autonomous Office Space (Strict No-Home Rule for certain programs)
      if (prog.prohibits_home_office) {
        if (!profile.autonomous_office) {
          score -= 25;
          if (status === 'eligible') status = 'conditional';
          failReasons.push('Το πρόγραμμα απαγορεύει έδρα σε κατοικία ή συστέγαση (απαιτείται αυτόνομος επαγγελματικός χώρος με μισθωτήριο).');
          nextSteps.push('Εξεύρεση αυτόνομου επαγγελματικού χώρου και ανάρτηση μισθωτηρίου στο Taxisnet πριν την αίτηση.');
        } else {
          passReasons.push('Αυτόνομη επαγγελματική έδρα εκτός οικίας (Πλήρης συμμόρφωση).');
        }
      }

      // Check 8: Sector Compatibility (ΚΑΔ)
      if (prog.restricted_sectors.indexOf(profile.sector) !== -1) {
        score = 0;
        status = 'ineligible';
        failReasons.push('Ο επιλεγμένος κλάδος δραστηριότητας (' + getSectorLabel(profile.sector) + ') εξαιρείται ρητά από τη δράση.');
      } else if (prog.allowed_sectors.indexOf(profile.sector) !== -1) {
        passReasons.push('Επιλέξιμος κλάδος δραστηριότητας βάσει ΚΑΔ (' + getSectorLabel(profile.sector) + ').');
      } else {
        score -= 20;
        if (status === 'eligible') status = 'conditional';
        failReasons.push('Απαιτείται ειδική διασταύρωση του τετραψήφιου ΚΑΔ στον επίσημο οδηγό επιλεξιμότητας.');
        nextSteps.push('Έλεγχος συμβατότητας δευτερευόντων ΚΑΔ της επιχείρησης.');
      }

      // Check 9: Geographic / LEADER Zone
      if (prog.id === 'leader_rural') {
        if (profile.region !== 'leader_zone' && profile.region !== 'mountain_remote') {
          score = 0;
          status = 'ineligible';
          failReasons.push('Το πρόγραμμα LEADER ισχύει αποκλειστικά σε χαρακτηρισμένες αγροτικές/νησιωτικές ζώνες παρέμβασης (όχι αστικά κέντρα Αττικής/Θεσσαλονίκης).');
        } else {
          score += 10;
          passReasons.push('Επιλέξιμη γεωγραφική ζώνη LEADER / Ορεινή-Νησιωτική περιοχή.');
        }
      }

      // Check 10: Investment Goal Alignment
      if (profile.investment_goal === 'digital_software' && (prog.id === 'espa_digital_basic' || prog.id === 'espa_digital_advanced')) {
        score += 15;
        passReasons.push('Άμεση σύγκλιση επενδυτικού στόχου με τις επιλέξιμες ψηφιακές δαπάνες.');
      } else if (profile.investment_goal === 'energy_efficiency' && (prog.id === 'ypen_exoikonomo_biz' || prog.id === 'espa_green_transition')) {
        score += 15;
        passReasons.push('Άμεση σύγκλιση επενδυτικού στόχου με την εξοικονόμηση ενέργειας.');
      }

      // Normalize score between 0 and 100
      score = Math.max(0, Math.min(100, score));

      if (status === 'ineligible') {
        score = 0;
      } else if (status === 'conditional' && score > 75) {
        score = 75; // Cap conditional score
      }

      if (status === 'eligible') {
        eligibleCount++;
        totalPotentialGrant += prog.max_grant_amount;
      } else if (status === 'conditional') {
        conditionalCount++;
        totalPotentialGrant += Math.round(prog.max_grant_amount * 0.7);
      }

      // Default next steps if eligible
      if (status === 'eligible' && nextSteps.length === 0) {
        nextSteps.push('Σύνταξη αναλυτικού προϋπολογισμού επενδυτικού σχεδίου.');
        nextSteps.push('Συλλογή δικαιολογητικών (βεβαίωση ΚΑΔ, ασφαλιστική & φορολογική ενημερότητα).');
        nextSteps.push('Δημιουργία χρήστη και υποβολή φακέλου στο ΟΠΣΚΕ (opske.gr).');
      }

      evaluatedPrograms.push({
        id: prog.id,
        name: prog.name,
        category: prog.category,
        managing_authority: prog.managing_authority,
        official_law: prog.official_law,
        cycle_status: prog.cycle_status,
        verified_at: prog.verified_at || DEFAULT_VERIFIED_DATE,
        cycle_badge_color: prog.cycle_badge_color,
        portal: prog.portal,
        short_desc: prog.short_desc,
        grant_ceiling_str: prog.grant_ceiling_str,
        max_grant_amount: prog.max_grant_amount,
        subsidy_rate: prog.subsidy_rate,
        funding_system: prog.funding_system,
        status: status,
        fit_score: score,
        pass_reasons: passReasons,
        fail_reasons: failReasons,
        next_steps: nextSteps,
        prep_guide_section: prog.prep_guide_section
      });
    });

    // Sort: Eligible first (descending score), then conditional, then ineligible
    evaluatedPrograms.sort(function (a, b) {
      if (a.status === 'eligible' && b.status !== 'eligible') return -1;
      if (a.status !== 'eligible' && b.status === 'eligible') return 1;
      if (a.status === 'conditional' && b.status === 'ineligible') return -1;
      if (a.status === 'ineligible' && b.status === 'conditional') return 1;
      return b.fit_score - a.fit_score;
    });

    var topProgram = evaluatedPrograms.length > 0 && evaluatedPrograms[0].status !== 'ineligible'
      ? evaluatedPrograms[0]
      : null;

    return {
      profile: profile,
      de_minimis: {
        received: deMinimisReceived,
        limit: DE_MINIMIS_LIMIT_2026,
        remaining: deMinimisRemaining,
        is_exceeded: deMinimisExceeded,
        rolling_summary: rollingSummary,
        used_entries: hasEntries
      },
      cash_bridge: cashBridge,
      verified_at: DEFAULT_VERIFIED_DATE,
      summary: {
        total_programs_evaluated: PROGRAMS_DB.length,
        eligible_count: eligibleCount,
        conditional_count: conditionalCount,
        ineligible_count: PROGRAMS_DB.length - (eligibleCount + conditionalCount),
        total_potential_grant: totalPotentialGrant,
        top_program: topProgram
      },
      programs: evaluatedPrograms
    };
  }

  function getStageLabel(stage) {
    switch (stage) {
      case 'unregistered': return 'Υπό Ίδρυση (Άνεργος / Ιδιώτης)';
      case 'newborn': return 'Νεοσύστατη (<1 έτος λειτουργίας)';
      case 'existing': return 'Υφιστάμενη (>1 έτος λειτουργίας)';
      default: return stage || 'Μη ορισμένο';
    }
  }

  function getSectorLabel(sector) {
    switch (sector) {
      case 'services_it': return 'Τεχνολογία, Πληροφορική & Digital';
      case 'consulting_engineering': return 'Τεχνικές Υπηρεσίες, Μηχανικοί & Σύμβουλοι';
      case 'retail_wholesale': return 'Εμπόριο (Χονδρικό / Λιανικό)';
      case 'tourism_hospitality': return 'Τουρισμός & Φιλοξενία';
      case 'manufacturing_craft': return 'Μεταποίηση, Βιοτεχνία & Παραγωγή';
      case 'food_dining': return 'Εστίαση & Καφέ';
      default: return sector || 'Λοιπές Υπηρεσίες';
    }
  }

  function getRegionLabel(region) {
    switch (region) {
      case 'attica': return 'Περιφέρεια Αττικής';
      case 'central_macedonia': return 'Κεντρική Μακεδονία (Θεσσαλονίκη κ.α.)';
      case 'islands': return 'Νησιωτική Ελλάδα (Κυκλάδες, Δωδεκάνησα, Ιόνιο)';
      case 'mountain_remote': return 'Ορεινή / Απομακρυσμένη Περιοχή';
      case 'leader_zone': return 'Χαρακτηρισμένη Ζώνη Παρέμβασης LEADER';
      default: return 'Λοιπή Ηπειρωτική Περιφέρεια';
    }
  }

  /**
   * Generates a complete Markdown dossier for the user's screening result.
   */
  function generateMarkdownReport(evalResult) {
    var p = evalResult.profile;
    var s = evalResult.summary;
    var dm = evalResult.de_minimis;
    var now = new Date();
    var dateStr = now.toLocaleDateString('el-GR', { year: 'numeric', month: 'long', day: 'numeric' });

    var md = '# Ενδεικτική Προ-Αξιολόγηση Προγραμμάτων ΕΣΠΑ & ΔΥΠΑ 2026\n\n';
    md += '**Ημερομηνία Αξιολόγησης:** ' + dateStr + ' | **Τελευταία Επαλήθευση Προσκλήσεων:** ' + (evalResult.verified_at || DEFAULT_VERIFIED_DATE) + '  \n';
    md += '**Εργαλείο:** Hellenic Subsidy Screener (Conversionlogic)  \n';
    md += '**Αποτέλεσμα Προ-Αξιολόγησης:** ' + (s.eligible_count > 0 ? '[ΕΝΔΕΙΚΤΙΚΗ ΠΡΟ-ΑΞΙΟΛΟΓΗΣΗ: ΕΝΤΟΠΙΣΤΗΚΑΝ ΣΥΜΒΑΤΕΣ ΔΡΑΣΕΙΣ]' : '[ΑΠΑΙΤΕΙΤΑΙ ΠΡΟΣΑΡΜΟΓΗ ΚΡΙΤΗΡΙΩΝ]') + '\n\n';
    md += '---\n\n';

    md += '## 1. Ταυτότητα Προφίλ Υποψηφίου\n\n';
    md += '| Παράμετρος | Δηλωθείσα Τιμή | Κατάσταση |\n';
    md += '| :--- | :--- | :--- |\n';
    md += '| **Στάδιο Επιχείρησης** | ' + getStageLabel(p.stage) + ' | ' + (p.stage === 'unregistered' ? 'Ιδανικό για ΔΥΠΑ / Ξεκινώ' : 'Ιδανικό για Ψηφιακό/Πράσινο') + ' |\n';
    md += '| **Κλάδος Δραστηριότητας** | ' + getSectorLabel(p.sector) + ' | Επιλέξιμος ΚΑΔ |\n';
    md += '| **Προσωπικό (ΕΜΕ)** | ' + (p.eme || '0') + ' ΕΜΕ | ' + (parseFloat(p.eme || 0) >= 1 ? 'Καλύπτει κριτήριο ΜμΕ' : 'Μηδενικό προσωπικό') + ' |\n';
    md += '| **Γεωγραφική Περιοχή** | ' + getRegionLabel(p.region) + ' | Περιφερειακή κατανομή |\n';
    md += '| **Ιδιότητα Ανεργίας** | ' + (p.is_unemployed ? 'Εγγεγραμμένος ΔΥΠΑ' : 'Μη εγγεγραμμένος / Εργαζόμενος') + ' | ' + (p.is_unemployed ? 'Επιλέξιμος για επιχορήγηση 14.800€' : '-') + ' |\n';
    md += '| **Πτυχίο ΑΕΙ/ΤΕΙ 2016+** | ' + (p.has_degree_2016 ? 'Ναι' : 'Όχι') + ' | ' + (p.has_degree_2016 ? 'Επιλέξιμος για ΕΣΠΑ Πτυχιούχων' : '-') + ' |\n';
    md += '| **Αυτόνομος Επαγγελματικός Χώρος** | ' + (p.autonomous_office ? 'Ναι (Εκτός οικίας)' : 'Όχι (Οικία / Συστέγαση)') + ' | ' + (p.autonomous_office ? 'Πλήρης συμμόρφωση' : 'Περιορισμός σε προγράμματα ΕΣΠΑ') + ' |\n';
    md += '| **Σώρευση De Minimis (3ετία)** | ' + dm.received.toLocaleString('el-GR') + ' € / ' + dm.limit.toLocaleString('el-GR') + ' € | ' + (dm.is_exceeded ? '[ΥΠΕΡΒΑΣΗ]' : 'Διαθέσιμο περιθώριο ' + dm.remaining.toLocaleString('el-GR') + ' €') + ' |\n\n';

    md += '---\n\n';
    md += '## 2. Σύνοψη Δυνατοτήτων Χρηματοδότησης\n\n';
    md += '- **Επιλέξιμα Προγράμματα:** `' + s.eligible_count + '`\n';
    md += '- **Προγράμματα Υπό Προϋποθέσεις:** `' + s.conditional_count + '`\n';
    md += '- **Μη Επιλέξιμα:** `' + s.ineligible_count + '`\n';
    md += '- **Εκτιμώμενος Συνολικός Κουμπαράς Επιχορήγησης:** **' + s.total_potential_grant.toLocaleString('el-GR') + ' €**\n';
    if (s.top_program) {
      md += '- **Κορυφαία Πρόταση (Top Match):** **' + s.top_program.name + '** (Fit Score: `' + s.top_program.fit_score + '%`)\n';
    }
    md += '\n---\n\n';

    md += '## 3. Αναλυτική Προ-Αξιολόγηση ανά Πρόγραμμα\n\n';
    evalResult.programs.forEach(function (prog) {
      var badge = prog.status === 'eligible' ? '[ΕΝΔΕΙΚΤΙΚΗ ΠΡΟ-ΑΞΙΟΛΟΓΗΣΗ: ΣΥΜΒΑΤΟ]' : (prog.status === 'conditional' ? '[ΥΠΟ ΠΡΟΫΠΟΘΕΣΕΙΣ]' : '[ΜΗ ΣΥΜΒΑΤΟ ΜΕ ΠΡΟΦΙΛ]');
      md += '### ' + prog.name + ' — ' + badge + ' (Fit Score: ' + prog.fit_score + '%)\n\n';
      md += '**Φορέας & Πύλη:** ' + prog.managing_authority + ' (' + prog.portal + ') | **Κατάσταση:** ' + (prog.cycle_status || '-') + ' (Επαλήθευση: ' + (prog.verified_at || DEFAULT_VERIFIED_DATE) + ')  \n';
      md += '**Ανώτατη Επιχορήγηση:** `' + prog.grant_ceiling_str + '` | **Ένταση Ενίσχυσης:** `' + prog.subsidy_rate + '`  \n';
      md += '**Σύστημα Πληρωμής:** ' + prog.funding_system + '  \n\n';
      md += '*' + prog.short_desc + '*\n\n';

      if (prog.pass_reasons.length > 0) {
        md += '**Θετικά Στοιχεία Συμβατότητας:**\n';
        prog.pass_reasons.forEach(function (r) { md += '- [+] ' + r + '\n'; });
        md += '\n';
      }

      if (prog.fail_reasons.length > 0) {
        md += '**Εμπόδια / Προϋποθέσεις προς Επίλυση:**\n';
        prog.fail_reasons.forEach(function (r) { md += '- [!] ' + r + '\n'; });
        md += '\n';
      }

      if (prog.next_steps.length > 0) {
        md += '**Άμεσα Βήματα Προετοιμασίας:**\n';
        prog.next_steps.forEach(function (s, idx) { md += (idx + 1) + '. ' + s + '\n'; });
        md += '\n';
      }
      md += '---\n\n';
    });

    md += '## 4. Νομική Αποποίηση & Μεθοδολογία (Disclaimer)\n\n';
    md += '> [!IMPORTANT]\n';
    md += '> Η παρούσα έκθεση αποτελεί **αυτοματοποιημένο τεχνικό προέλεγχο επιλεξιμότητας** βάσει των στοιχείων που καταχωρήθηκαν και των επίσημων οδηγών των προγραμμάτων ΕΣΠΑ 2021–2027 και ΔΥΠΑ. Δεν υποκαθιστά την επίσημη αξιολόγηση των αρμόδιων γνωμοδοτικών επιτροπών του ΟΠΣΚΕ ή της ΔΥΠΑ. Για την οριστική υποβολή φακέλου συνιστάται η συνεργασία με πιστοποιημένο σύμβουλο επιχειρήσεων.\n';

    return md;
  }

  return {
    PROGRAMS_DB: PROGRAMS_DB,
    DE_MINIMIS_LIMIT_2026: DE_MINIMIS_LIMIT_2026,
    DEFAULT_VERIFIED_DATE: DEFAULT_VERIFIED_DATE,
    computeDeMinimisFromEntries: computeDeMinimisFromEntries,
    computeCashBridge: computeCashBridge,
    evaluateProfile: evaluateProfile,
    generateMarkdownReport: generateMarkdownReport,
    getStageLabel: getStageLabel,
    getSectorLabel: getSectorLabel,
    getRegionLabel: getRegionLabel
  };
}));
