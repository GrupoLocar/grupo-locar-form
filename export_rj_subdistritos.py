import requests
import pandas as pd

# 1) Buscar todos os municípios do RJ (UF=33)
url_municipios = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios"
resp_mun = requests.get(url_municipios)
resp_mun.raise_for_status()
municipios = resp_mun.json()

rows = []

# 2) Para cada município, buscar subdistritos
for mun in municipios:
    mun_id = mun["id"]
    mun_nome = mun["nome"]
    url_sub = f"https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{mun_id}/subdistritos"
    resp_sub = requests.get(url_sub)
    resp_sub.raise_for_status()
    subdistritos = resp_sub.json()
    
    if subdistritos:
        for sd in subdistritos:
            rows.append({
                "Município": mun_nome,
                "Bairro (Subdistrito)": sd["nome"]
            })
    else:
        # Municípios sem subdistritos cadastrado
        rows.append({
            "Município": mun_nome,
            "Bairro (Subdistrito)": ""
        })

# 3) Montar DataFrame e exportar
df = pd.DataFrame(rows)
df.sort_values(["Município", "Bairro (Subdistrito)"], inplace=True)
df.to_excel("municipios_bairros_rj.xlsx", index=False)

print("Arquivo 'municipios_bairros_rj.xlsx' gerado com sucesso!")
