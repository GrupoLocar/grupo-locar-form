import React, { useEffect, useState } from "react";

export default function PainelLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function carregarLogs() {
      try {
        const res = await fetch("/api/listar-logs");
        if (!res.ok) throw new Error("Erro ao buscar logs");
        const data = await res.json();
        setLogs(data.logs);
      } catch (err) {
        setErro(err.message);
      } finally {
        setLoading(false);
      }
    }
    carregarLogs();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">📋 Painel de Logs</h2>

      {loading && <p>Carregando logs...</p>}
      {erro && <p className="text-red-600">Erro: {erro}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">Data</th>
              <th className="p-2 border">Ação</th>
              <th className="p-2 border">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="p-2 border text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="p-2 border font-medium">{log.acao}</td>
                <td className="p-2 border text-sm">
                  <pre className="whitespace-pre-wrap break-all">{JSON.stringify(log.detalhes, null, 2)}</pre>
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan="3" className="p-4 text-center text-gray-500">Nenhum log encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}