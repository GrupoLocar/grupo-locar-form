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

      const res = await fetch("/api/submit", {
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
          <h2 style="color: #15803d; font-size: 24px;">✅ Obrigado!</h2>
          <p style="font-size: 18px; margin-top: 10px;">Seu formulário foi enviado com sucesso.</p>
          <p style="color: #555;">Entraremos em contato em breve, se necessário.</p>
          <p style="display: inline-block; margin-top: 25px; padding: 10px 20px; background-color: #15803d; color: white; text-decoration: none; border-radius: 5px;">
            Agora você já pode fechar esta página!
          </p>
        </div>
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
