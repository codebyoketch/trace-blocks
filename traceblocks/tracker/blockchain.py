import time
import logging
import requests
from django.conf import settings
from thor_devkit import cry, transaction

logger = logging.getLogger(__name__)

class VeChainService:
    def __init__(self):
        # Fallbacks to public Testnet endpoints if not configured in settings.py
        self.node_url = getattr(settings, "VECHAIN_NODE_URL", "https://vechain.dev")
        self.private_key_hex = getattr(settings, "VECHAIN_PRIVATE_KEY", None)
        
        # Public test net genesis block ID (used as chain tag)
        # Mainnet would use: 0x00000000851caf3cfdb6e899cf5958017d1d44c419842436f87a7ae36ea24a25
        self.chain_tag = int(getattr(settings, "VECHAIN_CHAIN_TAG", "0x27"), 16) 

    def _get_block_ref(self):
        """Fetches the latest block ID to derive a valid 8-byte block reference."""
        try:
            res = requests.get(f"{self.node_url}/blocks/best", timeout=5)
            res.raise_for_status()
            best_block = res.json()
            block_id = best_block["id"]
            # The block reference is the first 8 bytes (16 hex chars) after the '0x'
            return int(block_id[2:18], 16)
        except Exception as e:
            logger.error("Failed to fetch block reference from VeChain node: %s", e)
            raise RuntimeError("Cannot reach VeChain node for block reference.")

    def record_tracking_event(self, sku: str, status: str, location: str, notes: str) -> str:
        """
        Signs and broadcasts an on-chain event. 
        Encodes the data payload into a transaction clause to log it permanently.
        """
        if not self.private_key_hex:
            logger.warning("VECHAIN_PRIVATE_KEY not set. Operating in dry-run/mock mode.")
            return f"mock_tx_hash_{int(time.time())}"

        # 1. Format the data string into bytes payload
        # For a full application, this string would correspond to a smart contract method call.
        # As a pure data log, we encode it directly into the clause's text field.
        payload_str = f"SKU:{sku}|STATUS:{status}|LOC:{location}|NOTES:{notes}"
        data_payload = payload_str.encode("utf-8")

        # 2. Build the tracking clause
        # To: None means a contract creation structure or arbitrary data broadcast anchor
        clause = {
            "to": "0x0000000000000000000000000000000000000000", # Multi-purpose data dump address
            "value": 0,
            "data": data_payload
        }

        # 3. Construct transaction parameters
        block_ref = self._get_block_ref()
        
        # Unique nonce to prevent double spending
        nonce = int(time.time() * 1000) & 0xFFFFFFFF

        tx_body = {
            "chainTag": self.chain_tag,
            "blockRef": block_ref,
            "expiration": 30,  # Valid for 30 blocks (~5 minutes)
            "clauses": [clause],
            "gasPriceCoef": 0,
            "gas": 50000,      # Adequate gas limits for data-only clauses
            "dependsOn": None,
            "nonce": nonce
        }

        # 4. Sign transaction via thor_devkit
        tx = transaction.Transaction(tx_body)
        private_key = cry.secp256k1.Private.from_hex(self.private_key_hex)
        tx.sign(private_key)

        # 5. Broadcast raw transaction stream to the VeChain REST API
        raw_tx_bytes = tx.encode()
        raw_tx_hex = "0x" + raw_tx_bytes.hex()

        try:
            res = requests.post(
                f"{self.node_url}/transactions",
                json={"raw": raw_tx_hex},
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            res.raise_for_status()
            tx_data = res.json()
            return tx_data["id"]
        except Exception as e:
            logger.error("VeChain transaction broadcast failed: %s", e)
            raise RuntimeWarning("Failed to broadcast transaction payload onto the ledger.")

    def get_tx_status(self, tx_id: str) -> str:
        """
        Queries transaction status. Returns 'pending', 'confirmed', or 'reverted'.
        """
        if tx_id.startswith("mock_tx_hash_"):
            return "confirmed"

        try:
            res = requests.get(f"{self.node_url}/transactions/{tx_id}/receipt", timeout=5)
            if res.status_code == 404 or res.json() is None:
                return "pending"
            
            res.raise_for_status()
            receipt = res.json()
            
            # Check for reverted transactions inside the execution receipt
            if receipt.get("reverted", False):
                return "reverted"
            
            return "confirmed"
        except Exception as e:
            logger.error("Failed to fetch transaction receipt for %s: %s", tx_id, e)
            return "pending"
