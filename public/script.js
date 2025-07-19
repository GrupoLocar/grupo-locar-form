// C:\grupo-locar-form\public\script.js
// -----------------------------------------------------------
// Máscaras, validações, envio com fetch e modal “aguarde”
// -----------------------------------------------------------

function mascaraTelefone(input) {
  input.value = input.value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/g, '($1)$2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 14);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formulario');
  const container = form?.parentElement;

  // Aplica Inputmask
  document.querySelectorAll('input[data-mask]').forEach(el => {
    const mask = el.getAttribute('data-mask');
    Inputmask({ mask }).mask(el);
  });

  // Atualiza nome do arquivo
  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', function () {
      const span = this.closest('.file-upload')?.querySelector('.file-name');
      if (span) {
        span.textContent = this.files.length ? this.files[0].name : 'Nenhum arquivo selecionado';
      }
    });
  });

  // Funções de normalização
  function formatarNomeEndereco(valor) {
    return valor
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, letra => letra.toUpperCase());
  }

  function validarEmail(valor) {
    return valor.toLowerCase();
  }

  // Modal de "aguarde"
  function showModal() {
    if (document.getElementById("aguardeModal")) return;
    const div = document.createElement("div");
    div.id = "aguardeModal";
    div.style.cssText = `
      position: fixed; top: 0; left: 0; inset: 0;
      background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
    `;
    div.innerHTML = `
      <div style="
        background: #fff; color:#333; padding: 24px 32px;
        border-radius: 8px; font-family: sans-serif; max-width: 320px;
        box-shadow: 0 4px 18px rgba(0,0,0,.25); text-align:center;
      ">
        <p style="margin:0; font-size:1.05rem;">
          <strong>Por favor aguarde!</strong><br>
          Suas informações estão sendo gravadas…
        </p>
      </div>
    `;
    document.body.appendChild(div);
  }

  function hideModal() {
    const div = document.getElementById("aguardeModal");
    if (div) div.remove();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Validação manual
    const invalidos = [];
    form.querySelectorAll('input, select, textarea').forEach(el => {
      const n = el.name;
      if (
        n === 'observacao' || el.type === 'hidden' ||
        n === 'nada_consta' || n === 'comprovante_mei'
      ) return;

      if (el.tagName === 'SELECT' && (!el.value || el.value === 'Selecione')) {
        invalidos.push(el);
      } else if (!el.value.trim()) {
        invalidos.push(el);
      }
    });

    if (invalidos.length) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      invalidos[0].focus();
      return;
    }

    // Máscaras completas?
    const mascaradosIncompletos = [];
    form.querySelectorAll("input[data-mask]").forEach(el => {
      const value = el.inputmask?.unmaskedvalue?.() || "";
      const expectedLength = (el.getAttribute("data-mask") || "").replace(/[^0-9]/g, "").length;
      if (value.length < expectedLength) mascaradosIncompletos.push(el);
    });

    if (mascaradosIncompletos.length > 0) {
      alert("Por favor, preencha corretamente todos os campos com máscara.");
      mascaradosIncompletos[0].focus();
      return;
    }

    // Normalização e validação personalizada
    const nomeInput = form.querySelector('input[name="nome"]');
    const enderecoInput = form.querySelector('input[name="endereco"]');
    const emailInput = form.querySelector('input[name="email"]');

    if (nomeInput) {
      nomeInput.value = formatarNomeEndereco(nomeInput.value);
    }

    if (enderecoInput) {
      enderecoInput.value = formatarNomeEndereco(enderecoInput.value);
    }

    if (emailInput) {
      emailInput.value = validarEmail(emailInput.value);
      if (!emailInput.value.includes('@')) {
        alert('O e-mail deve conter o caractere @');
        emailInput.focus();
        return;
      }
    }

    const formData = new FormData(form);
    const respostaEl = document.getElementById("resposta");

    try {
      showModal();

      const res = await fetch("https://grupo-locar-form.vercel.app/api/submit", {
        method: "POST",
        body: formData
      });

      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : { status: "erro", message: await res.text() };

      if (!res.ok) throw new Error(data.message || "Erro inesperado");

      if (container) {
        container.innerHTML = `
        <div style="text-align: center; margin-top: 80px; padding: 40px; background: #f0fdf4; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
          <h2 style="color: #15803d; margin-top: 20px; font-size: 24px;">✅ Obrigado!</h2>
          <p style="font-size: 18px; margin-top: 60px;">Seu formulário foi enviado com sucesso.</p>
          <p style="color: #555; margin-top: 40px;">Entraremos em contato em breve, se necessário.</p>
          <p style="display: inline-block; margin-top: 40px; margin-bottom: 40px; padding: 20px 20px; background-color: #15803d; color: white; text-decoration: none; border-radius: 5px;">
            Agora você já pode fechar esta página!
          </p>
        </div>
        <div style="text-align: center; margin-top: 40px; padding: 40px;">          
        </div>
        `;
      }

      respostaEl?.remove();
    } catch (err) {
      console.error("Erro de envio:", err);
      if (respostaEl) respostaEl.textContent = "Erro: " + err.message;
      alert("❌ Erro ao enviar o formulário:\n" + err.message);
    } finally {
      hideModal();
    }
  });
});
