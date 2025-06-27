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
