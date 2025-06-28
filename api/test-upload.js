// /api/test-upload.js
// Executa um POST em /api/submit usando um arquivo PDF gerado on‑the‑fly.
// Não precisa de fs; usa fetch integrado ao Node 18 na Vercel.

export default async function handler(req, res) {
  // Gera um PDF mínimo em memória
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<<>>\nstartxref\n0\n%%EOF"
  );

  const form = new FormData();
  form.append("nome", "Teste Serverless");
  form.append("email", "serverless@teste.com");
  form.append("cnh_arquivo", pdf, "dummy.pdf");

  try {
    const apiRes = await fetch(`${req.headers.origin}/api/submit`, {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    });

    const data = await apiRes.json();
    return res.status(apiRes.status).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "erro", detalhe: err.message });
  }
}
