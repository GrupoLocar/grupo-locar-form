document.getElementById("formulario").addEventListener("submit", async function (e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    document.getElementById("resposta").textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error("Erro:", err);
    alert("Erro ao enviar");
  }
});
