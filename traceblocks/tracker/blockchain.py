import time
import json
import logging
import requests
from django.conf import settings
from thor_devkit import cry, transaction

logger = logging.getLogger(__name__)


class VeChainService:
    def __init__(self):
        self.node_url        = getattr(settings, "VECHAIN_NODE_URL",   "https://node-testnet.vechain.energy")
        self.private_key_hex = getattr(settings, "VECHAIN_PRIVATE_KEY", None)
        self.chain_tag       = int(getattr(settings, "VECHAIN_CHAIN_TAG", "0x27"), 16)

    # ──────────────────────────────────────────────────────────────────────────

    def _get_block_ref(self):
        try:
            res = requests.get(f"{self.node_url}/blocks/best", timeout=5)
            res.raise_for_status()
            block_id = res.json()["id"]
            return "0x" + block_id[2:18]
        except Exception as e:
            logger.error("Failed to fetch block reference: %s", e)
            raise RuntimeError("Cannot reach VeChain node.")

    # ──────────────────────────────────────────────────────────────────────────

    def record_tracking_event(self, event_data: dict) -> str:
        """
        Record a supply-chain event on VeChain testnet.

        Returns the transaction ID string.
        Falls back to a mock hash when no private key is configured.
        """
        if not self.private_key_hex:
            logger.warning("No private key — running in mock mode.")
            return f"mock_tx_hash_{int(time.time())}"

        payload      = self._build_payload(event_data)
        payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
        data_hex     = "0x" + payload_json.encode("utf-8").hex()

        clause = {
            "to":    "0x0000000000000000000000000000000000000000",
            "value": 0,
            "data":  data_hex,
        }

        block_ref     = self._get_block_ref()
        nonce         = int(time.time() * 1000) & 0xFFFFFFFF
        estimated_gas = 21_000 + len(payload_json) * 68
        gas           = max(estimated_gas, 80_000)

        tx_body = {
            "chainTag":     self.chain_tag,
            "blockRef":     block_ref,
            "expiration":   30,
            "clauses":      [clause],
            "gasPriceCoef": 0,
            "gas":          gas,
            "dependsOn":    None,
            "nonce":        nonce,
        }

        # ── Sign using the SDK's own signing-hash method ───────────────────
        # IMPORTANT: call get_signing_hash() BEFORE encoding, then call
        # set_signature(). Encoding before signing produces the wrong
        # hash and the node rejects the transaction.
        tx_obj           = transaction.Transaction(tx_body)
        private_key_bytes = bytes.fromhex(self.private_key_hex)
        signing_hash = tx_obj.get_signing_hash()                     # ← correct for thor_devkit 1.0.x
        signature    = cry.secp256k1.sign(signing_hash, private_key_bytes)
        tx_obj.set_signature(signature)                              # ← correct for thor_devkit 1.0.x

        raw_tx_hex = "0x" + tx_obj.encode().hex()

        try:
            res = requests.post(
                f"{self.node_url}/transactions",
                json={"raw": raw_tx_hex},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            res.raise_for_status()
            tx_id = res.json()["id"]
            logger.info("Transaction broadcast: %s", tx_id)
            return tx_id
        except Exception as e:
            logger.error("Broadcast failed: %s", e)
            raise

    # ──────────────────────────────────────────────────────────────────────────

    def _build_payload(self, d: dict) -> dict:
        """
        Build a compact on-chain payload from the raw event dict.
        Only non-empty / truthy values are included to keep gas costs low.
        """
        def _bool(val) -> bool:
            return val == "yes" or val is True

        raw = {
            # Identity
            "uid":  d.get("user_id"),
            "name": d.get("full_name"),

            # Event
            "eid":    d.get("event_id"),
            "evt":    d.get("event_name"),
            "desc":   d.get("short_description"),
            "detail": d.get("detailed_explanation"),
            "exc":    _bool(d.get("exceptions_noted")),
            "reg":    _bool(d.get("regulatory_flag")),
            "qc":     _bool(d.get("quality_check_passed")),

            # Goods
            "goods": d.get("goods_name"),
            "cat":   d.get("goods_category"),
            "qty":   d.get("quantity"),
            "unit":  d.get("unit_of_measure"),
            "batch": d.get("batch_number"),
            "cond":  d.get("goods_condition"),
            "cold":  _bool(d.get("cold_chain")),
            "haz":   _bool(d.get("hazardous")),

            # Dispatcher
            "disp": {
                "n":    d.get("dispatcher_name"),
                "role": d.get("dispatcher_role"),
                "sig":  d.get("dispatcher_signature"),
                "date": d.get("dispatcher_date"),
            },

            # Recipient
            "recv": {
                "n":    d.get("recipient_name"),
                "role": d.get("recipient_role"),
                "sig":  d.get("recipient_signature"),
                "date": d.get("recipient_date"),
            },

            # Logistics — includes GPS coordinates
            "lgx": {
                "carrier":  d.get("carrier_name"),
                "waybill":  d.get("tracking_number"),
                "mode":     d.get("transport_mode"),
                "from":     d.get("origin_location"),
                "to":       d.get("destination_location"),
                "dispatch": d.get("dispatch_datetime"),
                "eta":      d.get("estimated_delivery"),
                "plate":    d.get("vehicle_plate"),
                "driver":   d.get("driver_name"),
                "notes":    d.get("logistics_notes"),
                "ins":      _bool(d.get("insurance_covered")),
                "cust":     _bool(d.get("customs_cleared")),
                "lat":      d.get("latitude"),
                "lng":      d.get("longitude"),
            },
        }

        return self._strip_empty(raw)

    def _strip_empty(self, obj):
        if isinstance(obj, dict):
            cleaned = {}
            for k, v in obj.items():
                v2 = self._strip_empty(v)
                if isinstance(v2, dict) and not v2:
                    continue
                if v2 is None or v2 == "" or v2 is False:
                    continue
                cleaned[k] = v2
            return cleaned
        return obj

    # ──────────────────────────────────────────────────────────────────────────

    def get_tx_status(self, tx_id: str) -> str:
        if tx_id.startswith("mock_tx_hash_"):
            return "confirmed"
        try:
            res = requests.get(
                f"{self.node_url}/transactions/{tx_id}/receipt",
                timeout=5,
            )
            if res.status_code == 404:
                return "pending"
            receipt = res.json()
            if receipt is None:
                return "pending"
            return "reverted" if receipt.get("reverted", False) else "confirmed"
        except Exception as e:
            logger.error("Receipt fetch failed: %s", e)
            return "pending"