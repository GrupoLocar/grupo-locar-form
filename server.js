const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
console.log('🧪 Verificando .env em:', envPath);
if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env NÃO encontrado no caminho:', envPath);
  process.exit(1);
}

require('dotenv').config({ path: path.resolve(__dirname, '.env') });
console.log('MONGO_URI:', process.env.MONGO_URI);

const express = require('express');
const multer = require('multer');
const { Dropbox } = require('dropbox');
const mongoose = require('mongoose');

const app = express();
const upload = multer({ dest: 'temp/' });

if (!process.env.MONGO_URI) {
  console.error('❌ Erro: MONGO_URI não encontrado no arquivo .env');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch(err => {
  console.error('❌ Erro ao conectar no MongoDB:', err.message);
  process.exit(1);
});

const FuncionarioSchema = new mongoose.Schema({
  nome: String,
  email: String,
  arquivos: [String],
});
const Funcionario = mongoose.model('Funcionario', FuncionarioSchema);

if (!process.env.ACCESS_TOKEN) {
  console.error('❌ Erro: ACCESS_TOKEN não encontrado no arquivo .env');
  process.exit(1);
}

const dbx = new Dropbox({ accessToken: process.env.ACCESS_TOKEN });

app.post('/upload', upload.array('arquivos'), async (req, res) => {
  const { nome, email } = req.body;
  const links = [];

  for (const file of req.files) {
    const fileContent = fs.readFileSync(file.path);
    const dropboxPath = `/uploads/${Date.now()}_${file.originalname}`;

    try {
      const uploadRes = await dbx.filesUpload({ path: dropboxPath, contents: fileContent });
      const sharedRes = await dbx.sharingCreateSharedLinkWithSettings({ path: uploadRes.result.path_lower });

      const url = sharedRes.result.url.replace('?dl=0', '?raw=1');
      links.push(url);
    } catch (err) {
      return res.status(500).json({ message: 'Erro ao enviar para Dropbox', error: err });
    } finally {
      fs.unlinkSync(file.path);
    }
  }

  try {
    const novoFuncionario = new Funcionario({ nome, email, arquivos: links });
    await novoFuncionario.save();
    res.json({ message: 'Enviado com sucesso!', links });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao salvar no banco de dados', error: err });
  }
});

app.get('/', (req, res) => {
  res.send('🚀 API Formulário de Cadastro está online!');
});

app.listen(3000, () => console.log('🚀 Servidor rodando na porta 3000'));
