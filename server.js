require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Dropbox } = require('dropbox');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'temp/' });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const FuncionarioSchema = new mongoose.Schema({
  nome: String,
  email: String,
  arquivos: [String],
});
const Funcionario = mongoose.model('Funcionario', FuncionarioSchema);

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
      fs.unlinkSync(file.path); // remove arquivo temporário
    }
  }

  const novoFuncionario = new Funcionario({ nome, email, arquivos: links });
  await novoFuncionario.save();

  res.json({ message: 'Enviado com sucesso!', links });
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
