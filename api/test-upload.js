const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

(async () => {
  const form = new FormData();

  // Campos simulados do formulário
  form.append("nome", "Teste Fictício");
  form.append("email", "teste@email.com");
  form.append("telefone", "(11)91234-5678");
  form.append("data_nascimento", "1990-01-01");
  form.append("validade_cnh", "2028-12-31");
  form.append("cpf", "123.456.789-00");

  // Simulando arquivos reais
  form.append("cnh_arquivo", fs.createReadStream(path.join(__dirname, "dummy.pdf")));
  form.append("comprovante_mei", fs.createReadStream(path.join(__dirname, "dummy2.pdf")));

  try {
    const res = await axios.post("http://localhost:3000/api/submit", form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity
    });

    console.log("✅ RESPOSTA:", res.data);
  } catch (error) {
    if (error.response) {
      console.error("❌ ERRO:", error.response.data);
    } else {
      console.error("❌ ERRO DE REDE:", error.message);
    }
  }
})();
