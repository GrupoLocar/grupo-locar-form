#!/usr/bin/env python3
"""
Gerador de refresh token do Dropbox
----------------------------------
1. Pede APP_KEY e APP_SECRET
2. Mostra a URL para autorizar (token_access_type=offline, response_type=code)
3. Pede o AUTHORIZATION_CODE que aparece na URL de redirecionamento
4. Faz POST /oauth2/token e exibe access_token + refresh_token
"""

import base64
import requests

# -------------------------- Entrada do usuário --------------------------
app_key = input("Enter APP_KEY: ").strip()
app_secret = input("Enter APP_SECRET: ").strip()

# -------------------------- Passo 1: URL de autorização -----------------
authorize_url = (
    "https://www.dropbox.com/oauth2/authorize"
    f"?client_id={app_key}"
    "&token_access_type=offline"
    "&response_type=code"
    "&redirect_uri=https://localhost/finish"
)

print("\n➡️  Abra esta URL no navegador, autorize a aplicação e copie o código:")
print(authorize_url)

# -------------------------- Passo 2: Recebe AUTHORIZATION_CODE ----------
auth_code = input("\nEnter AUTHORIZATION_CODE: ").strip()

# -------------------------- Passo 3: Troca código por tokens ------------
auth_header = base64.b64encode(f"{app_key}:{app_secret}".encode()).decode()

response = requests.post(
    "https://api.dropboxapi.com/oauth2/token",
    headers={
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/x-www-form-urlencoded",
    },
    data={
        "code": auth_code,
        "grant_type": "authorization_code",
        "redirect_uri": "https://localhost/finish",
    },
    timeout=30,
)

print("\n📦  Resposta da API Dropbox:")
try:
    print(response.json())
except Exception as err:
    print("Erro ao ler JSON:", err)
    print("Resposta bruta:", response.text)
