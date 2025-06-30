// -----------------------------------------------------------
// script.js  – máscaras, validações, envio com fetch e modal
// -----------------------------------------------------------

// === Helpers de data =======================================
function formatDateInput(valor = '') {
  if (!valor) return '';
  let d;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const [dia, mes, ano] = valor.split('/');
    d = new Date(`${ano}-${mes}-${dia}T00:00:00`);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    d = new Date(`${valor}T00:00:00`);
  } else {
    d = new Date(valor);
  }
  if (Number.isNaN(d)) return '';
  return d.toISOString().slice(0, 10);           // yyyy‑MM‑dd
}

function formatDateISO(valor = '') {
  const base = formatDateInput(valor);           // yyyy‑MM‑dd
  return base ? `${base}T00:00:00.000Z` : null;  // ISO completo
}
// ===========================================================

function mascaraTelefone(input) {
  input.value = input.value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/g, '($1)$2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 14);
}

document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('formulario');
  const container = form?.parentElement;

  /* Inputmask para CEP/CPF/etc. */
  document.querySelectorAll('input[data-mask]').forEach(el => {
    Inputmask({ mask: el.getAttribute('data-mask') }).mask(el);
  });

  /* Label do arquivo */
  document.querySelectorAll('input[type="file"]').forEach(inp => {
    inp.addEventListener('change', function () {
      const span = this.closest('.file-upload')?.querySelector('.file-name');
      if (span) span.textContent = this.files.length ? this.files[0].name : 'Nenhum arquivo selecionado';
    });
  });

  /* Modal “aguarde” */
  const showModal = () => {
    if (document.getElementById('aguardeModal')) return;
    const div = document.createElement('div');
    div.id = 'aguardeModal';
    div.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;z-index:9999`;
    div.innerHTML = `
      <div style="background:#fff;padding:24px 32px;border-radius:8px;
                  font-family:sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.25)">
        <strong>Por favor aguarde!</strong><br/>Suas informações estão sendo gravadas…
      </div>`;
    document.body.appendChild(div);
  };
  const hideModal = () => document.getElementById('aguardeModal')?.remove();

  /* ------- SUBMIT ------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* -------- validação simples -------- */
    const obrigatorios = Array.from(form.querySelectorAll('input,select,textarea'))
      .filter(el => !['hidden', 'file'].includes(el.type) && el.required);
    const vazio = obrigatorios.find(el => !el.value || el.value === 'Selecione');
    if (vazio) { alert('Preencha todos os campos obrigatórios.'); vazio.focus(); return; }

    /* Máscaras completas */
    const incompletos = Array.from(form.querySelectorAll('input[data-mask]'))
      .filter(el => (el.inputmask?.isComplete && !el.inputmask.isComplete()));
    if (incompletos.length) { alert('Preencha corretamente todos os campos.'); incompletos[0].focus(); return; }

    /* -------- converte campos‑data no FormData -------- */
    const fd = new FormData(form);
    const toISO = (name) => {
      const v = fd.get(name);
      if (v) fd.set(name, formatDateISO(v));     // yyyy‑MM‑ddT00:00:00.000Z
    };
    ['dataValidadeCNH', 'data_nascimento', 'data_admissao', 'dataUltimoServicoPrestado']
      .forEach(toISO);

    /* -------- envio -------- */
    showModal();
    try {
      const res = await fetch('https://grupo-locar-form.vercel.app/api/submit', {
        method: 'POST',
        body  : fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro inesperado');

      container.innerHTML = `
        <div style="text-align:center;margin-top:80px;background:#f0fdf4;padding:40px;border-radius:12px">
          <h2 style="color:#15803d">✅ Obrigado!</h2>
          <p>Seu formulário foi enviado com sucesso.</p>
          <p>Agora você já pode fechar esta página.</p>
        </div>`;
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar: ' + err.message);
    } finally {
      hideModal();
    }
  });
});
