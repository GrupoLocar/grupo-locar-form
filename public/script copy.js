faça a junção dos códigos abaixo, o primeiro bloco de código é o atual que corresponde ao fluxo correto do formulário que deve ser mantido completo com funções de máscaras, Inputmask dos campos, Atualização do nome do arquivo exibido, Envio do formulário com validação + FormData, Validação manual de campos obrigatórios, Verificar se todos os campos com máscara estão totalmente preenchidos, Exibir mensagem de agradecimento. O segundo bloco de código possui funções para exibir uma mensagem modal ao clicar no botão "Enviar" evitando que o usuário clique várias vezes no botão "Enviar". Faça a junção dos códigos do primeiro e segundo bloco, acrescentando as funções do segundo bloco sem remover as funçãos do primeiro bloco.

// Funções de máscara (caso precise aplicar manualmente)
function mascaraTelefone(input) {
  input.value = input.value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/g, '($1)$2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 14);
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formulario');
  const container = form?.parentElement;

  // Aplicar Inputmask para campos com data-mask
  document.querySelectorAll('input[data-mask]').forEach(el => {
    const mask = el.getAttribute('data-mask');
    Inputmask({ mask }).mask(el);
  });

  // Atualizar nome do arquivo exibido
  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', function () {
      const span = this.closest('.file-upload')?.querySelector('.file-name');
      if (span) {
        span.textContent = this.files.length ? this.files[0].name : 'Nenhum arquivo selecionado';
      }
    });
  });

  // Envio do formulário com validação + FormData
  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Validação manual de campos obrigatórios
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

    // Envio via fetch + FormData
    const formData = new FormData(form);

    // Verificar se todos os campos com máscara estão totalmente preenchidos
    const mascaradosIncompletos = [];
    form.querySelectorAll("input[data-mask]").forEach(el => {
      const value = el.inputmask?.unmaskedvalue?.() || "";
      const expectedLength = (el.getAttribute("data-mask") || "").replace(/[^0-9]/g, "").length;

      if (value.length < expectedLength) {
        mascaradosIncompletos.push(el);
      }
    });

    if (mascaradosIncompletos.length > 0) {
      alert("Por favor, preencha corretamente todos os campos com máscara.");
      mascaradosIncompletos[0].focus();
      return;
    }

    try {
      const respostaEl = document.getElementById("resposta");
      
      const res = await fetch("https://grupo-locar-form.vercel.app/api/submit", {
        method: "POST",
        body: formData
      });

      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : { status: "erro", message: await res.text() };

      if (!res.ok) {
        throw new Error(data.message + (data.detalhe ? " - " + data.detalhe : ""));
      }

      // ✅ Exibir mensagem de agradecimento
      if (container) {
        container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #f0fdf4; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
          <h2 style="color: #15803d; font-size: 24px;"></h2>
        <div style="text-align: center; padding: 40px; background: #f0fdf4; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
          <h2 style="color: #15803d; font-size: 24px;">✅ Obrigado!</h2>
          <p style="font-size: 18px; margin-top: 10px;">Seu formulário foi enviado com sucesso.</p>
          <p style="color: #555;">Entraremos em contato em breve, se necessário.</p>
          <p style="display: inline-block; margin-top: 25px; padding: 20px 20px; background-color: #15803d; color: white; text-decoration: none; border-radius: 5px;">
            Agora você já pode fechar esta página!
          </p>
        </div>
              <div style="text-align: center; padding: 20px; background: #f0fdf4; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
          <h2 style="color: #15803d; font-size: 24px;"></h2>
      `;
      }

      document.getElementById("resposta")?.remove();

    } catch (err) {
      const respostaEl = document.getElementById("resposta");
      console.error("Erro de envio:", err);
      if (respostaEl) {
        respostaEl.textContent = "Erro: " + err.message;
      }
      alert("❌ Erro ao enviar o formulário:\n" + err.message);
    }
  });
});

// public/script.js
// -----------------------------------------------------------
// Envia dados do formulário para a API e exibe um modal
// de “aguarde” para impedir cliques repetidos.
// -----------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // TODO: troque pelo id real do seu <form>
  const form = document.getElementById("funcionarioForm");
  // TODO: troque se o botão tiver outro seletor
  const btnEnviar = form.querySelector("button[type='submit']");

  /** Mostra modal “aguarde” */
  function showModal() {
    if (document.getElementById("aguardeModal")) return; // já existe
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

  /** Remove modal “aguarde” */
  function hideModal() {
    const div = document.getElementById("aguardeModal");
    if (div) div.remove();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Se ainda há campos inválidos, deixe o HTML5 exibir as bolhas
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Cria o FormData
    const formData = new FormData(form);

    try {
      btnEnviar.disabled = true;
      showModal();

      const response = await fetch(
        "https://grupo-locar-form.vercel.app/api/submit",
        { method: "POST", body: formData }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Falha no envio");

      alert("Cadastro enviado com sucesso!");
      form.reset();
    } catch (err) {
      alert("Erro: " + err.message);
      console.error(err);
    } finally {
      hideModal();
      btnEnviar.disabled = false;
    }
  });
});
