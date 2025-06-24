(async () => {
    const tbody = document.querySelector("#tabela tbody");
    const res   = await fetch("/api/records");
    const dados = await res.json();
  
    dados.forEach(doc => {
      const tr   = document.createElement("tr");
      const tdNm = `<td>${doc.nome || "-"}</td>`;
      const tdEm = `<td>${doc.email || "-"}</td>`;
      const tdDt = `<td>${new Date(doc.data_envio).toLocaleString("pt-BR")}</td>`;
  
      // monta lista de links
      const files = Object.entries(doc.arquivos || {})
                          .map(([campo, url]) =>
                            `<a href="${url}" target="_blank" rel="noopener">${campo}</a>`).join(" | ");
  
      tr.innerHTML = tdNm + tdEm + tdDt + `<td>${files}</td>`;
      tbody.appendChild(tr);
    });
  })();
  