import time
import json
import hashlib
import logging
import requests
from django.conf import settings
from thor_devkit import cry, transaction

logger = logging.getLogger(__name__)


class VeChainService:
    def __init__(self):
        self.node_url = getattr(settings, "VECHAIN_NODE_URL", "https://node-testnet.vechain.energy")
        self.private_key_hex = getattr(settings, "VECHAIN_PRIVATE_KEY", None)
        self.chain_tag = int(getattr(settings, "VECHAIN_CHAIN_TAG", "0x27"), 16)

    def _get_block_ref(self):
        try:
            res = requests.get(f"{self.node_url}/blocks/best", timeout=5)
            print("Response body:", res.text)
            res.raise_for_status()
            block_id = res.json()["id"]
            return "0x" + block_id[2:18]
        except Exception as e:
            logger.error("Failed to fetch block reference: %s", e)
            raise RuntimeError("Cannot reach VeChain node.")

    def record_tracking_event(self, event_data: dict) -> str:
        """
        Record a full supply chain event on VeChain.

        Expected keys in event_data (all from the TraceBlocks form):

        Identity:
            user_id, full_name

        Event:
            event_id, event_name, short_description, detailed_explanation,
            exceptions_noted, regulatory_flag, quality_check_passed, needs_detail

        Goods:
            goods_name, goods_category, quantity, unit_of_measure,
            batch_number, goods_condition, cold_chain, hazardous

        Dispatcher:
            dispatcher_name, dispatcher_role, dispatcher_signature,
            dispatcher_date, dispatcher_confirmed

        Recipient:
            recipient_name, recipient_role, recipient_signature,
            recipient_date, recipient_confirmed

        Logistics:
            carrier_name, tracking_number, transport_mode,
            origin_location, destination_location, dispatch_datetime,
            estimated_delivery, vehicle_plate, driver_name,
            logistics_notes, insurance_covered, customs_cleared
        """
        if not self.private_key_hex:
            logger.warning("No private key — running in mock mode.")
            return f"mock_tx_hash_{int(time.time())}"

        # Build a compact but complete payload.
        # Only non-empty / non-False values are included to keep the on-chain
        # footprint small (every byte costs gas).
        payload = self._build_payload(event_data)
        payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
        data_hex = "0x" + payload_json.encode("utf-8").hex()

        clause = {
            "to":    "0x0000000000000000000000000000000000000000",
            "value": 0,
            "data":  data_hex,
        }

        block_ref = self._get_block_ref()
        nonce = int(time.time() * 1000) & 0xFFFFFFFF

        # Estimate gas: base 21 000 + 68 bytes per data byte (rough upper bound)
        estimated_gas = 21_000 + len(payload_json) * 68
        gas = max(estimated_gas, 80_000)   # floor of 80k to be safe

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

        # Sign
        tx = transaction.Transaction(tx_body)
        private_key_bytes = bytes.fromhex(self.private_key_hex)
        encoded = tx.encode()
        h = hashlib.new("blake2b", digest_size=32)
        h.update(encoded)
        signing_hash = h.digest()
        signature = cry.secp256k1.sign(signing_hash, private_key_bytes)
        tx.set_signature(signature)

        # Broadcast
        raw_tx_hex = "0x" + tx.encode().hex()
        try:
            res = requests.post(
                f"{self.node_url}/transactions",
                json={"raw": raw_tx_hex},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            print("Response body:", res.text)
            res.raise_for_status()
            tx_id = res.json()["id"]
            logger.info("Transaction broadcast: %s", tx_id)
            return tx_id
        except Exception as e:
            logger.error("Broadcast failed: %s", e)
            raise

    # ──────────────────────────────────────────────────────────────────────────
    # INTERNAL HELPERS
    # ──────────────────────────────────────────────────────────────────────────

    def _build_payload(self, d: dict) -> dict:
        """
        Convert the raw form dict into a lean, structured payload.
        Omits blank strings and False-y boolean fields so we don't waste gas.
        """
        def _bool(val) -> bool:
            """Checkbox fields arrive as 'yes' (checked) or absent (unchecked)."""
            return val == "yes" or val is True

        def _keep(val):
            """Return True if the value is worth recording on-chain."""
            if val is None:
                return False
            if isinstance(val, str) and not val.strip():
                return False
            if isinstance(val, bool):
                return val          # only keep True booleans
            return True

        raw = {
            # ── Identity ────────────────────────────────────────────────────
            "uid":   d.get("user_id"),
            "name":  d.get("full_name"),

            # ── Event ───────────────────────────────────────────────────────
            "eid":   d.get("event_id"),
            "evt":   d.get("event_name"),
            "desc":  d.get("short_description"),
            "detail": d.get("detailed_explanation"),
            "exc":   _bool(d.get("exceptions_noted")),
            "reg":   _bool(d.get("regulatory_flag")),
            "qc":    _bool(d.get("quality_check_passed")),

            # ── Goods ───────────────────────────────────────────────────────
            "goods": d.get("goods_name"),
            "cat":   d.get("goods_category"),
            "qty":   d.get("quantity"),
            "unit":  d.get("unit_of_measure"),
            "batch": d.get("batch_number"),
            "cond":  d.get("goods_condition"),
            "cold":  _bool(d.get("cold_chain")),
            "haz":   _bool(d.get("hazardous")),

            # ── Dispatcher ──────────────────────────────────────────────────
            "disp": {
                "n":    d.get("dispatcher_name"),
                "role": d.get("dispatcher_role"),
                "sig":  d.get("dispatcher_signature"),
                "date": d.get("dispatcher_date"),
            },

            # ── Recipient ───────────────────────────────────────────────────
            "recv": {
                "n":    d.get("recipient_name"),
                "role": d.get("recipient_role"),
                "sig":  d.get("recipient_signature"),
                "date": d.get("recipient_date"),
            },

            # ── Logistics ───────────────────────────────────────────────────
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
            },
        }

        # Strip empty / False values recursively so the JSON is as compact as possible
        return self._strip_empty(raw)

    def _strip_empty(self, obj):
        if isinstance(obj, dict):
            cleaned = {}
            for k, v in obj.items():
                v2 = self._strip_empty(v)
                if isinstance(v2, dict) and not v2:
                    continue        # drop empty sub-dicts
                if v2 is None or v2 == "" or v2 is False:
                    continue        # drop blank / false values
                cleaned[k] = v2
            return cleaned
        return obj

    # ──────────────────────────────────────────────────────────────────────────

    def get_tx_status(self, tx_id: str) -> str:
        if tx_id.startswith("mock_tx_hash_"):
            return "confirmed"
        try:
            res = requests.get(f"{self.node_url}/transactions/{tx_id}/receipt", timeout=5)
            if res.status_code == 404:
                return "pending"
            receipt = res.json()
            if receipt is None:
                return "pending"
            return "reverted" if receipt.get("reverted", False) else "confirmed"
        except Exception as e:
            logger.error("Receipt fetch failed: %s", e)
            return "pending"