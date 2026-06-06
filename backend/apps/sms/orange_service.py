# apps/sms/orange_service.py
"""
Service d'envoi SMS via l'API Orange SMS.
Gère deux domaines : NETSYSTEME et SSE.

Variables d'environnement requises :
  ORANGE_CLIENT_ID, ORANGE_CLIENT_SECRET, ORANGE_SENDER_NAME      → NETSYSTEME
  ORANGE_CLIENT_ID_SSE, ORANGE_CLIENT_SECRET_SSE, ORANGE_SENDER_NAME_SSE → SSE
  ORANGE_SENDER_ADDRESS  → numéro SDA (ex: tel:+221775428842)
"""
import base64
import os
from decouple import config
import urllib.parse
from datetime import datetime, timedelta

import requests


class OrangeSMSService:
    def __init__(self, sender_domain: str = "NETSYSTEME"):
        self.sender_domain = sender_domain.upper()

        if self.sender_domain == "SSE":
            self.client_id     = config("ORANGE_CLIENT_ID_SSE")
            self.client_secret = config("ORANGE_CLIENT_SECRET_SSE")
            self.sender_name   = config("ORANGE_SENDER_NAME_SSE", "SSE")
        else:  # NETSYSTEME par défaut
            self.client_id     = config("ORANGE_CLIENT_ID")
            self.client_secret = config("ORANGE_CLIENT_SECRET")
            self.sender_name   = config("ORANGE_SENDER_NAME", "NETSYSTEME")

        # ← Ajout : validation immédiate
        if not self.client_id or not self.client_secret:
            raise ValueError(
                f"Variables d'environnement manquantes pour le domaine '{self.sender_domain}'. "
                f"Vérifiez ORANGE_CLIENT_ID et ORANGE_CLIENT_SECRET dans votre .env"
            )

        self.base_url       = "https://api.orange.com"
        self.sender_address = config("ORANGE_SENDER_ADDRESS", "tel:+221775428842")
        self.access_token   = None
        self.token_expiry   = None

    # ── Authentification ──────────────────────────────────────────────────────
    def _basic_auth(self) -> str:
        credentials = f"{self.client_id}:{self.client_secret}"
        return base64.b64encode(credentials.encode()).decode()

    def get_access_token(self, force_refresh: bool = False) -> str:
        """Obtenir ou renouveler le token OAuth2."""
        if not force_refresh and self.access_token and self.token_expiry:
            if datetime.now() < self.token_expiry:
                return self.access_token

        url = f"{self.base_url}/oauth/v3/token"
        headers = {
            "Authorization": f"Basic {self._basic_auth()}",
            "Content-Type":  "application/x-www-form-urlencoded",
            "Accept":        "application/json",
        }
        try:
            resp = requests.post(
                url, headers=headers,
                data={"grant_type": "client_credentials"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                self.access_token = data["access_token"]
                expires_in = data.get("expires_in", 3600)
                self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 60)
                return self.access_token

            raise Exception(f"Erreur auth Orange {resp.status_code}: {resp.text}")

        except requests.exceptions.Timeout:
            raise Exception("Timeout lors de la connexion à l'API Orange")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Erreur réseau lors de l'authentification: {str(e)}")

    # ── Formatage numéro ──────────────────────────────────────────────────────
    def _format_phone(self, phone: str) -> str:
        """Normalise un numéro sénégalais au format tel:+221XXXXXXXXX."""
        phone = str(phone).strip()
        phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

        if phone.startswith("tel:+"):
            return phone
        if phone.startswith("+"):
            return f"tel:{phone}"
        if phone.startswith("00221"):
            return f"tel:+{phone[2:]}"
        if phone.startswith("221") and not phone.startswith("+"):
            return f"tel:+{phone}"
        if len(phone) == 9 and phone[0] in ("7", "8"):
            return f"tel:+221{phone}"
        # Fallback : on préfixe par +221
        return f"tel:+221{phone}"

    # ── Envoi simple ──────────────────────────────────────────────────────────
    def send_sms(self, phone_number: str, message: str) -> dict:
        """
        Envoyer un SMS à un numéro.

        Returns:
            dict avec clés : success (bool), message (str), sender_domain (str),
                             data (dict, si succès), error (str, si échec)
        """
        if not self.access_token:
            self.get_access_token()

        formatted = self._format_phone(phone_number)
        encoded   = urllib.parse.quote(self.sender_address, safe="")
        url       = f"{self.base_url}/smsmessaging/v1/outbound/{encoded}/requests"

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }
        payload = {
            "outboundSMSMessageRequest": {
                "address":       formatted,
                "senderAddress": self.sender_address,
                "senderName":    self.sender_name,
                "outboundSMSTextMessage": {"message": message},
            }
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=15)

            # Token expiré → on renouvelle et on réessaie une fois
            if resp.status_code == 401:
                self.get_access_token(force_refresh=True)
                headers["Authorization"] = f"Bearer {self.access_token}"
                resp = requests.post(url, headers=headers, json=payload, timeout=15)

            if resp.status_code in (200, 201):
                return {
                    "success":       True,
                    "data":          resp.json(),
                    "message":       "SMS envoyé avec succès",
                    "sender_domain": self.sender_domain,
                }

            # Extraire le message d'erreur lisible
            error_detail = resp.text
            try:
                ej = resp.json()
                if "requestError" in ej:
                    error_detail = (
                        ej["requestError"]
                        .get("serviceException", {})
                        .get("text", error_detail)
                    )
                elif "error" in ej:
                    error_detail = ej.get("error", {}).get("message", error_detail)
            except Exception:
                pass

            friendly = {
                400: f"Requête invalide — {error_detail}",
                401: "Authentification échouée — vérifiez vos credentials Orange",
                403: f"Accès interdit — sender name '{self.sender_name}' non validé ?",
                404: "Service non trouvé — vérifiez l'URL de l'API",
                429: "Trop de requêtes — réessayez dans quelques instants",
                500: "Erreur serveur Orange — réessayez plus tard",
                503: "Service temporairement indisponible",
            }.get(resp.status_code, f"Erreur {resp.status_code}")

            return {
                "success":       False,
                "error":         error_detail,
                "message":       friendly,
                "status_code":   resp.status_code,
                "sender_domain": self.sender_domain,
            }

        except requests.exceptions.Timeout:
            return {
                "success":       False,
                "error":         "Timeout",
                "message":       "Délai d'attente dépassé lors de l'envoi du SMS",
                "sender_domain": self.sender_domain,
            }
        except requests.exceptions.RequestException as e:
            return {
                "success":       False,
                "error":         str(e),
                "message":       "Échec de l'envoi du SMS",
                "sender_domain": self.sender_domain,
            }

    # ── Envoi groupé ──────────────────────────────────────────────────────────
    def send_bulk_sms(self, recipients: list) -> dict:
        """
        Envoyer des SMS personnalisés à plusieurs destinataires.

        Args:
            recipients: liste de dicts avec clés 'phone', 'message', 'name' (optionnel)

        Returns:
            dict avec clés : success (list), failed (list), total (int), sender_domain (str)
        """
        results = {
            "success":       [],
            "failed":        [],
            "total":         len(recipients),
            "sender_domain": self.sender_domain,
        }

        for i, recipient in enumerate(recipients, 1):
            phone   = recipient.get("phone", "")
            message = recipient.get("message", "")
            name    = recipient.get("name", phone)

            result = self.send_sms(phone, message)
            entry  = {"name": name, "phone": phone}

            if result["success"]:
                results["success"].append(entry)
            else:
                results["failed"].append({
                    **entry,
                    "error": result.get("message", "Erreur inconnue"),
                })

        return results


# ── Personnalisation de message ───────────────────────────────────────────────
def personalize_message(template: str, data: dict) -> str:
    """
    Remplace les placeholders dans le template avec les données du client.

    Placeholders supportés :
      {entreprise}, {company_name}, {contact}, {contact_name},
      {prenom}, {nom}, {email}, {telephone}, {ville}

    Args:
        template: chaîne avec des placeholders entre accolades
        data:     dict associant nom de placeholder → valeur

    Returns:
        Message personnalisé
    """
    for key, value in data.items():
        template = template.replace(f"{{{key}}}", str(value) if value else "")
    return template