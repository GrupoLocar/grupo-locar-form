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

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData
      });

      const resultado = await res.json();

      if (resultado.ok || resultado.status === 'ok') {
        alert('Formulário enviado com sucesso!');
        form.reset();
        document.querySelectorAll('.file-name').forEach(span => {
          span.textContent = 'Nenhum arquivo selecionado';
        });
      } else {
        alert('Erro ao enviar formulário.');
      }
    } catch (err) {
      console.error('Erro de envio:', err);
      alert('Erro ao conectar com o servidor.');
    }
  });
});
