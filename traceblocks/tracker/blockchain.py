import time
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
            return "0x" + block_id[2:18]   # hex string, not int
        except Exception as e:
            logger.error("Failed to fetch block reference: %s", e)
            raise RuntimeError("Cannot reach VeChain node.")

    def record_tracking_event(self, sku: str, status: str, location: str, notes: str) -> str:
        if not self.private_key_hex:
            logger.warning("No private key — running in mock mode.")
            return f"mock_tx_hash_{int(time.time())}"

        payload_str = f"SKU:{sku}|STATUS:{status}|LOC:{location}|NOTES:{notes}"
        data_hex = "0x" + payload_str.encode("utf-8").hex()   # hex string

        clause = {
            "to":    "0x0000000000000000000000000000000000000000",
            "value": 0,
            "data":  data_hex,
        }

        block_ref = self._get_block_ref()
        nonce = int(time.time() * 1000) & 0xFFFFFFFF

        tx_body = {
            "chainTag":    self.chain_tag,
            "blockRef":    block_ref,
            "expiration":  30,
            "clauses":     [clause],
            "gasPriceCoef": 0,
            "gas":         50000,
            "dependsOn":   None,
            "nonce":       nonce,
        }

        # Sign
        tx = transaction.Transaction(tx_body)
        private_key_bytes = bytes.fromhex(self.private_key_hex)
        encoded = tx.encode()
        h = hashlib.new('blake2b', digest_size=32)
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