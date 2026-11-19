/**
 * Hellenic Subsidy Screener - Strict CSP UI Controller
 * Zero inline style strings, Zero external CDNs, Zero emojis
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var STORAGE_KEY = 'cl_p6_v1';

  function defaultFormData() {
    return {
      stage: 'unregistered',
      founder_age: 'under_30',
      is_unemployed: true,
      has_asd: true,
      has_degree_2016: true,
      personal_income: 'under_10k',
      military_cleared: true,
      sector: 'services_it',
      eme: '0',
      autonomous_office: true,
      region: 'attica',
      investment_goal: 'startup_costs',
      de_minimis_received: '0',
      de_minimis_entries: [
        { date: '', amount: '' },
        { date: '', amount: '' },
        { date: '', amount: '' }
      ],
      capex_eur: '30000',
      subsidy_pct: '50',
      vat_pro_rata_pct: '100'
    };
  }

  var state = {
    currentStep: 1,
    totalSteps: 6,
    formData: defaultFormData(),
    evalResult: null
  };

  var wizardPane = document.getElementById('wizard-pane');
  var resultsPane = document.getElementById('results-pane');
  var progressFill = document.getElementById('progress-fill');
  var currentStepNum = document.getElementById('current-step-num');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var restartBtn = document.getElementById('btn-restart');
  var printReportBtn = document.getElementById('btn-print-report');
  var copyReportBtn = document.getElementById('btn-copy-report');

  loadState();
  updateWizardUI();
  setupOptionCards();
  setupInputs();
  var quickTriageApi = setupQuickTriage();
  setupEventListeners();

  function updateWizardUI() {
    for (var i = 1; i <= state.totalSteps; i++) {
      var pane = document.getElementById('step-' + i);
      if (pane) pane.classList.remove('active');
    }
    var currentPane = document.getElementById('step-' + state.currentStep);
    if (currentPane) currentPane.classList.add('active');

    if (progressFill) progressFill.className = 'progress-fill step-prog-' + state.currentStep;
    if (currentStepNum) currentStepNum.textContent = state.currentStep;

    if (btnPrev) {
      btnPrev.disabled = state.currentStep === 1;
      btnPrev.classList.toggle('btn-invisible', state.currentStep === 1);
    }

    if (btnNext) {
      btnNext.textContent = state.currentStep === state.totalSteps
        ? 'Ενδεικτική Προ-Αξιολόγηση'
        : 'Επόμενο Βήμα';
    }
  }

  function setupOptionCards() {
    var optionCards = document.querySelectorAll('.option-card');
    optionCards.forEach(function (card) {
      card.addEventListener('click', function () {
        var group = card.getAttribute('data-group');
        var value = card.getAttribute('data-value');
        var siblings = document.querySelectorAll('.option-card[data-group="' + group + '"]');
        siblings.forEach(function (sib) { sib.classList.remove('selected'); });
        card.classList.add('selected');
        state.formData[group] = value;
        saveState();
        handleConditionalFields();
      });
    });
  }

  function setupInputs() {
    var checkboxes = document.querySelectorAll('input[type="checkbox"][data-field]');
    checkboxes.forEach(function (cb) {
      var field = cb.getAttribute('data-field');
      cb.checked = !!state.formData[field];
      cb.addEventListener('change', function () {
        state.formData[field] = cb.checked;
        saveState();
        handleConditionalFields();
      });
    });

    var inputs = document.querySelectorAll('input[data-field]:not([type="checkbox"]), select[data-field]');
    inputs.forEach(function (inp) {
      var field = inp.getAttribute('data-field');
      if (state.formData[field] !== undefined) {
        inp.value = state.formData[field];
      }
      inp.addEventListener('input', function () {
        state.formData[field] = inp.value;
        saveState();
        handleConditionalFields();
      });
    });

    for (var key in state.formData) {
      if (Object.prototype.hasOwnProperty.call(state.formData, key)) {
        var card = document.querySelector('.option-card[data-group="' + key + '"][data-value="' + state.formData[key] + '"]');
        if (card) {
          var siblings = document.querySelectorAll('.option-card[data-group="' + key + '"]');
          siblings.forEach(function (sib) { sib.classList.remove('selected'); });
          card.classList.add('selected');
        }
      }
    }

    handleConditionalFields();
    syncDmEntryInputs();
    updateStep6Summaries();
  }

  function syncDmEntryInputs() {
    var entries = state.formData.de_minimis_entries || [];
    for (var idx = 1; idx <= 3; idx++) {
      var row = entries[idx - 1] || { date: '', amount: '' };
      var dEl = document.getElementById('dmDate' + idx);
      var aEl = document.getElementById('dmAmt' + idx);
      if (dEl) dEl.value = row.date || '';
      if (aEl) aEl.value = row.amount || '';
    }
  }

  function readDmEntryInputs() {
    var list = [];
    for (var idx = 1; idx <= 3; idx++) {
      var dEl = document.getElementById('dmDate' + idx);
      var aEl = document.getElementById('dmAmt' + idx);
      list.push({ date: dEl ? dEl.value : '', amount: aEl ? aEl.value : '' });
    }
    state.formData.de_minimis_entries = list;
  }

  function updateStep6Summaries() {
    if (!window.EspaScreenerEngine) return;
    var dmInfo = window.EspaScreenerEngine.computeDeMinimisFromEntries(state.formData.de_minimis_entries || []);
    var dmEl = document.getElementById('dmRollingSummary');
    if (dmEl) {
      dmEl.textContent = 'Ενεργή σώρευση 3ετίας (από ' + dmInfo.cutoffIso + '): ' +
        dmInfo.total3Yr.toLocaleString('el-GR') + ' €' +
        (dmInfo.excludedOlder > 0 ? ' (εκτός 3ετίας: ' + dmInfo.excludedOlder.toLocaleString('el-GR') + ' €)' : '');
    }
    var cb = window.EspaScreenerEngine.computeCashBridge(
      state.formData.capex_eur,
      state.formData.subsidy_pct,
      24,
      state.formData.vat_pro_rata_pct
    );
    var cbEl = document.getElementById('cashBridgeWizardPreview');
    if (cbEl) {
      cbEl.textContent = 'Γέφυρα μετρητών: ' + cb.bridgeLiquidity.toLocaleString('el-GR') +
        ' € (Ίδια ' + cb.ownEquity.toLocaleString('el-GR') + ' € + ΦΠΑ 24% ' + cb.vatTotal.toLocaleString('el-GR') +
        ' €) · Μόνιμος μη εκπιπτόμενος ΦΠΑ (' + (100 - cb.vatProRataPct) + '%): ' +
        cb.nonRecoverableVat.toLocaleString('el-GR') + ' €';
    }
  }

  function setupStep6ExtraListeners() {
    document.querySelectorAll('.dm-entry-input').forEach(function (el) {
      el.addEventListener('input', function () {
        readDmEntryInputs();
        saveState();
        updateStep6Summaries();
      });
      el.addEventListener('change', function () {
        readDmEntryInputs();
        saveState();
        updateStep6Summaries();
      });
    });

    ['capexInput', 'subsidyPctInput', 'vatProRataInput'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', updateStep6Summaries);
      el.addEventListener('change', updateStep6Summaries);
    });

    var exportBtn = document.getElementById('btnExportP6Json');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var payload = { app: 'Hellenic Subsidy Screener', version: 1, exportedAt: new Date().toISOString(), formData: state.formData };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'espa-screener-draft-' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        var st = document.getElementById('p6StorageStatus');
        if (st) st.textContent = 'Εξήχθη αντίγραφο JSON τοπικά.';
      });
    }

    var impBtn = document.getElementById('btnImportP6Json');
    var impIn = document.getElementById('importP6JsonInput');
    if (impBtn && impIn) {
      impBtn.addEventListener('click', function () { impIn.click(); });
      impIn.addEventListener('change', function (ev) {
        var f = ev.target.files && ev.target.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var p = JSON.parse(String(rd.result || ''));
            if (!p || !p.formData || typeof p.formData !== 'object') throw new Error('Invalid');
            state.formData = Object.assign(defaultFormData(), p.formData);
            setupInputs();
            saveState();
            var st = document.getElementById('p6StorageStatus');
            if (st) st.textContent = 'Εισήχθησαν επιτυχώς τα δεδομένα από JSON.';
          } catch (_) {
            var st2 = document.getElementById('p6StorageStatus');
            if (st2) st2.textContent = 'Σφάλμα: Μη έγκυρο αρχείο JSON.';
          }
        };
        rd.readAsText(f, 'utf-8');
        ev.target.value = '';
      });
    }

    var clrBtn = document.getElementById('btnClearP6');
    if (clrBtn) {
      clrBtn.addEventListener('click', function () {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        try { localStorage.removeItem('espa_screener_state'); } catch (_) {}
        state.formData = defaultFormData();
        state.currentStep = 1;
        setupInputs();
        updateWizardUI();
        if (quickTriageApi) {
          quickTriageApi.syncQuickSelectsFromState();
          quickTriageApi.renderQuickTriage();
        }
        var st = document.getElementById('p6StorageStatus');
        if (st) st.textContent = 'Τα τοπικά δεδομένα καθαρίστηκαν και επανήλθαν οι προεπιλογές.';
      });
    }
  }

  function handleConditionalFields() {
    var stage = state.formData.stage;
    var dypaGroup = document.getElementById('dypa-criteria-group');
    var degreeIncomeGroup = document.getElementById('degree-income-group');

    if (dypaGroup) {
      dypaGroup.classList.toggle('is-hidden', stage !== 'unregistered');
    }
    if (degreeIncomeGroup) {
      degreeIncomeGroup.classList.toggle('is-hidden', !state.formData.has_degree_2016);
    }
  }

  function setupQuickTriage() {
    var qtStage = document.getElementById('qtStage');
    var qtRegion = document.getElementById('qtRegion');
    var qtDeMinimis = document.getElementById('qtDeMinimis');
    var qtResult = document.getElementById('quickTriageResult');
    if (!qtStage || !qtRegion || !qtDeMinimis || !qtResult) return;

    function syncQuickSelectsFromState() {
      qtStage.value = state.formData.stage || 'unregistered';
      qtRegion.value = state.formData.region || 'attica';
      var dmVal = Number(state.formData.de_minimis_received || 0);
      qtDeMinimis.value = dmVal > 300000 ? '310000' : (dmVal >= 100000 ? '150000' : (dmVal > 0 ? '50000' : '0'));
    }

    function renderQuickTriage() {
      if (!window.EspaScreenerEngine) return;
      var evalRes = window.EspaScreenerEngine.evaluateProfile(state.formData);
      var dm = evalRes.de_minimis;
      var matched = evalRes.programs.filter(function (pr) { return pr.status !== 'ineligible'; }).slice(0, 3);
      var names = matched.map(function (pr) { return pr.name.split(':')[0] + ' (' + pr.grant_ceiling_str + ')'; });

      qtResult.className = 'triage-result ' + (dm.is_exceeded || matched.length === 0 ? 'is-blocked' : 'is-ready');
      var summaryHtml = '';
      if (dm.is_exceeded) {
        summaryHtml = '<div class="triage-summary"><strong>Αποκλεισμός De Minimis (&gt; 300.000 €):</strong> Το όριο 3ετίας έχει καλυφθεί — δεν προτείνεται υποβολή ΕΣΠΑ/ΔΥΠΑ σε αυτή τη φάση.</div>';
      } else if (matched.length === 0) {
        summaryHtml = '<div class="triage-summary"><strong>Χωρίς άμεσο ταίριασμα:</strong> Επιλέξτε τα 6 βήματα παρακάτω για έλεγχο ειδικών κριτηρίων (ΕΜΕ, ΚΑΔ, ιδιότητα ανέργου).</div>';
      } else {
        summaryHtml = '<div class="triage-summary"><strong>Άμεση Ένδειξη (' + matched.length + ' πιθανές δράσεις · Υπόλοιπο De Minimis: ' + escapeHtml(dm.remaining.toLocaleString('el-GR')) + ' €):</strong> ' + escapeHtml(names.join(' · ')) + '</div>';
      }
      summaryHtml += '<button type="button" id="qtJumpResultsBtn" class="btn btn-primary btn-sm">Προβολή Αναλυτικής Έκθεσης</button>';
      qtResult.innerHTML = summaryHtml;

      var jumpBtn = document.getElementById('qtJumpResultsBtn');
      if (jumpBtn) {
        jumpBtn.addEventListener('click', function () {
          runEvaluation();
        });
      }
    }

    qtStage.addEventListener('change', function () {
      state.formData.stage = qtStage.value;
      saveState();
      setupInputs();
      renderQuickTriage();
    });
    qtRegion.addEventListener('change', function () {
      state.formData.region = qtRegion.value;
      saveState();
      setupInputs();
      renderQuickTriage();
    });
    qtDeMinimis.addEventListener('change', function () {
      state.formData.de_minimis_received = qtDeMinimis.value;
      state.formData.de_minimis_entries = [
        { date: '', amount: '' },
        { date: '', amount: '' },
        { date: '', amount: '' }
      ];
      var dmInp = document.querySelector('input[data-field="de_minimis_received"]');
      if (dmInp) dmInp.value = qtDeMinimis.value;
      syncDmEntryInputs();
      updateStep6Summaries();
      saveState();
      renderQuickTriage();
    });

    syncQuickSelectsFromState();
    renderQuickTriage();
    return { syncQuickSelectsFromState: syncQuickSelectsFromState, renderQuickTriage: renderQuickTriage };
  }

  function setupEventListeners() {
    setupStep6ExtraListeners();
    if (btnPrev) {
      btnPrev.addEventListener('click', function () {
        if (state.currentStep > 1) {
          state.currentStep--;
          updateWizardUI();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', function () {
        if (state.currentStep < state.totalSteps) {
          state.currentStep++;
          updateWizardUI();
        } else {
          runEvaluation();
        }
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        resultsPane.classList.add('is-hidden');
        wizardPane.classList.remove('is-hidden');
        state.currentStep = 1;
        updateWizardUI();
      });
    }

    if (printReportBtn) {
      printReportBtn.addEventListener('click', function () {
        window.print();
      });
    }

    if (copyReportBtn) {
      copyReportBtn.addEventListener('click', function () {
        if (!state.evalResult) return;
        var md = window.EspaScreenerEngine.generateMarkdownReport(state.evalResult);
        copyToClipboard(md, copyReportBtn, 'Αντιγράφηκε!', 'Αντιγραφή Έκθεσης (Markdown)');
      });
    }

    var waitlistForm = document.getElementById('proWaitlistForm');
    if (waitlistForm) {
      waitlistForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var emailEl = document.getElementById('proWaitlistEmail');
        var consentEl = document.getElementById('proWaitlistConsent');
        var statusEl = document.getElementById('proWaitlistStatus');
        var submitBtn = document.getElementById('proWaitlistBtn');
        var emailVal = (emailEl ? emailEl.value : '').trim();

        function setStatus(msg, cls) {
          if (!statusEl) return;
          statusEl.textContent = msg;
          statusEl.className = 'waitlist-status ' + cls;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          setStatus('Παρακαλούμε εισάγετε μια έγκυρη διεύθυνση email.', 'err');
          if (emailEl) emailEl.focus();
          return;
        }
        if (!consentEl || !consentEl.checked) {
          setStatus('Απαιτείται η ρητή συγκατάθεσή σας (GDPR checkbox) πριν την αποστολή.', 'err');
          if (consentEl) consentEl.focus();
          return;
        }

        var adviceEl = document.getElementById('proWaitlistAdvice');
        var adviceVal = adviceEl ? adviceEl.value : '';
        var consentLabel = waitlistForm.querySelector('.waitlist-consent span');
        var consentText = consentLabel ? consentLabel.textContent.trim() : 'Explicit GDPR Waitlist Opt-In';
        if (submitBtn) submitBtn.disabled = true;
        setStatus('Καταχώριση αιτήματος...', '');

        fetch('https://conversionlogic-waitlist.conversionlogic.workers.dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailVal,
            project: 'espa-screener-gr',
            advice_focus: adviceVal,
            consent: true,
            consent_text: consentText,
            consent_ts: new Date().toISOString()
          })
        })
          .then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (data) {
              return { ok: resp.ok, data: data };
            });
          })
          .then(function (res) {
            if (res.ok && res.data && res.data.ok) {
              waitlistForm.reset();
              setStatus('Επιτυχής εγγραφή στη δωρεάν λίστα προτεραιότητας (0€ Validation Mode).', 'ok');
            } else {
              setStatus((res.data && res.data.error) || 'Σφάλμα καταχώρισης. Δοκιμάστε ξανά.', 'err');
            }
          })
          .catch(function () {
            setStatus('Αδυναμία σύνδεσης με τον διακομιστή λίστας αναμονής.', 'err');
          })
          .finally(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
    }
  }

  function runEvaluation() {
    if (!window.EspaScreenerEngine) return;
    state.evalResult = window.EspaScreenerEngine.evaluateProfile(state.formData);
    wizardPane.classList.add('is-hidden');
    resultsPane.classList.remove('is-hidden');
    renderResultsView(state.evalResult);
  }

  function statusMeta(status) {
    if (status === 'eligible') return ['badge-eligible', 'ΔΥΝΗΤΙΚΑ ΣΥΜΒΑΤΟ (ΠΡΟ-ΑΞΙΟΛΟΓΗΣΗ)'];
    if (status === 'conditional') return ['badge-conditional', 'ΥΠΟ ΠΡΟΫΠΟΘΕΣΕΙΣ'];
    return ['badge-ineligible', 'ΜΗ ΣΥΜΒΑΤΟ ΜΕ ΠΡΟΦΙΛ'];
  }

  function renderResultsView(res) {
    var s = res.summary;
    var dm = res.de_minimis;
    var cb = res.cash_bridge;

    document.getElementById('stat-total-grant').textContent = s.total_potential_grant.toLocaleString('el-GR') + ' €';
    document.getElementById('stat-eligible-count').textContent = s.eligible_count;
    document.getElementById('stat-conditional-count').textContent = s.conditional_count;
    document.getElementById('stat-deminimis-remain').textContent = dm.remaining.toLocaleString('el-GR') + ' €';

    var bridgeBox = document.getElementById('cashBridgeSummaryRow');
    if (bridgeBox && cb) {
      bridgeBox.innerHTML =
        '<h3 class="sheet-heading">Γέφυρα Ρευστότητας &amp; Μικτό Καθεστώς ΦΠΑ (Pro-Rata ' + escapeHtml(cb.vatProRataPct) + '%)</h3>' +
        '<p class="field-hint">Επιλέξιμη επένδυση ' + escapeHtml(cb.capex.toLocaleString('el-GR')) + ' € · Επιδότηση ' + escapeHtml(cb.grantAmount.toLocaleString('el-GR')) + ' € (' + escapeHtml(cb.grantRatePct) + '%) · ' +
        'Ίδια συμμετοχή ' + escapeHtml(cb.ownEquity.toLocaleString('el-GR')) + ' € · ΦΠΑ 24% ' + escapeHtml(cb.vatTotal.toLocaleString('el-GR')) + ' € · ' +
        '<strong>Απαιτούμενη Γέφυρα Μετρητών: ' + escapeHtml(cb.bridgeLiquidity.toLocaleString('el-GR')) + ' €</strong> · ' +
        'Μόνιμος μη εκπιπτόμενος ΦΠΑ (Pro-Rata): <strong>' + escapeHtml(cb.nonRecoverableVat.toLocaleString('el-GR')) + ' €</strong>.</p>';
    }

    // 1. Render Institutional Table
    var tableBody = document.getElementById('resultsTableBody');
    if (tableBody) {
      tableBody.innerHTML = '';
      res.programs.forEach(function (prog) {
        var tr = document.createElement('tr');
        var meta = statusMeta(prog.status);
        var reasonsShort = (prog.pass_reasons || []).slice(0, 2).join(' · ') || '—';
        var gapsShort = (prog.fail_reasons || []).slice(0, 2).join(' · ') || 'Καμία εμφανής έλλειψη';
        var sourceCol = [prog.managing_authority || '', prog.cycle_status || prog.official_law || '', 'Επαλήθευση: ' + (prog.verified_at || '19/11/2026')].filter(Boolean).join(' · ');

        tr.innerHTML =
          '<td><strong>' + escapeHtml(prog.name) + '</strong><br><span class="program-meta">' + escapeHtml(prog.grant_ceiling_str) + ' · ' + escapeHtml(prog.subsidy_rate) + '</span></td>' +
          '<td><span class="badge ' + meta[0] + '">' + meta[1] + '</span></td>' +
          '<td>' + escapeHtml(reasonsShort) + '</td>' +
          '<td>' + escapeHtml(gapsShort) + '</td>' +
          '<td>' + escapeHtml(sourceCol) + '</td>';
        tableBody.appendChild(tr);
      });
    }

    // 2. Render Detailed Program Dossiers
    var container = document.getElementById('programs-list-container');
    if (!container) return;
    container.innerHTML = '';

    res.programs.forEach(function (prog) {
      var meta = statusMeta(prog.status);
      var card = document.createElement('div');
      card.className = 'program-card status-' + prog.status;

      var html = '';
      html += '<div class="program-top-bar">';
      html += '  <div>';
      html += '    <h3 class="program-title">' + escapeHtml(prog.name) + '</h3>';
      html += '    <div class="program-meta">' + escapeHtml(prog.managing_authority) + ' · ' + escapeHtml(prog.official_law || '') + '</div>';
      if (prog.cycle_status) {
        html += '    <div class="cycle-row"><span class="badge badge-conditional">' + escapeHtml(prog.cycle_status) + ' · Επαλήθευση ' + escapeHtml(prog.verified_at || '19/11/2026') + '</span></div>';
      }
      html += '  </div>';
      html += '  <span class="badge ' + meta[0] + '">' + meta[1] + '</span>';
      html += '</div>';

      html += '<div class="program-details-grid">';
      html += '  <div><div class="detail-item-label">Ανώτατη Επιχορήγηση</div><div class="detail-item-val">' + escapeHtml(prog.grant_ceiling_str) + '</div></div>';
      html += '  <div><div class="detail-item-label">Ποσοστό Επιδότησης</div><div class="detail-item-val">' + escapeHtml(prog.subsidy_rate) + '</div></div>';
      html += '  <div><div class="detail-item-label">Τρόπος Καταβολής</div><div class="detail-item-val pay-val">' + escapeHtml(prog.funding_system) + '</div></div>';
      html += '</div>';

      html += '<p class="prog-desc">' + escapeHtml(prog.short_desc) + '</p>';

      if (prog.pass_reasons && prog.pass_reasons.length > 0) {
        html += '<h4 class="pass-hdr">Θετικά Κριτήρια Συμβατότητας:</h4><ul class="reasons-list">';
        prog.pass_reasons.forEach(function (r) { html += '<li>' + escapeHtml(r) + '</li>'; });
        html += '</ul>';
      }

      if (prog.fail_reasons && prog.fail_reasons.length > 0) {
        html += '<h4 class="fail-hdr">Ελλείψεις / Προϋποθέσεις προς Επίλυση:</h4><ul class="reasons-list">';
        prog.fail_reasons.forEach(function (r) { html += '<li>' + escapeHtml(r) + '</li>'; });
        html += '</ul>';
      }

      if (prog.next_steps && prog.next_steps.length > 0) {
        html += '<div class="next-steps-box"><div class="next-steps-title">Επόμενα Βήματα Προετοιμασίας (ΟΠΣΚΕ / Φάκελος):</div><ol>';
        prog.next_steps.forEach(function (step) { html += '<li>' + escapeHtml(step) + '</li>'; });
        html += '</ol></div>';
      }

      card.innerHTML = html;
      container.appendChild(card);
    });
  }

  function copyToClipboard(text, btnElement, successMsg, defaultMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        handleCopySuccess(btnElement, successMsg, defaultMsg);
      }).catch(function () {
        fallbackCopyText(text, btnElement, successMsg, defaultMsg);
      });
    } else {
      fallbackCopyText(text, btnElement, successMsg, defaultMsg);
    }
  }

  function fallbackCopyText(text, btnElement, successMsg, defaultMsg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.className = 'sr-copy-buffer';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      handleCopySuccess(btnElement, successMsg, defaultMsg);
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function handleCopySuccess(btnElement, successMsg, defaultMsg) {
    if (!btnElement) return;
    btnElement.textContent = successMsg;
    setTimeout(function () {
      btnElement.textContent = defaultMsg;
    }, 2500);
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.formData)); } catch (e) {}
  }

  function loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('espa_screener_state');
      if (saved) {
        var parsed = JSON.parse(saved);
        for (var k in parsed) {
          if (Object.prototype.hasOwnProperty.call(parsed, k)) state.formData[k] = parsed[k];
        }
      }
    } catch (e) {}
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
