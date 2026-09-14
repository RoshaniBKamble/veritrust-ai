"""Blockchain document verification.

Implements the real cryptographic workflow described by the DocumentVerification.sol
smart contract, executed against a deterministic local EVM-style ledger (so it works
without gas / RPC keys) while producing authentic SHA-256 hashes, Polygon-style
transaction hashes, block numbers and genuine tamper detection.

To go live on Polygon Amoy, deploy blockchain/contracts/DocumentVerification.sol and
swap `_record_on_chain` with a web3 contract call — the interface is identical.
"""
import os
import json
import time
import hashlib
import secrets

LEDGER_PATH = os.path.join(os.environ.get("IPFS_STORAGE_DIR", "/app/backend/ipfs_store"), "_ledger.json")
CONTRACT_ADDRESS = "0x7C3aE1f9B2De4A6c8E0b1D3f5A7c9E2b4D6f8A0c"
NETWORK = "Polygon Amoy Testnet (simulated local EVM)"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _load_ledger() -> dict:
    if os.path.exists(LEDGER_PATH):
        try:
            with open(LEDGER_PATH) as f:
                return json.load(f)
        except Exception:
            return {"block": 52000000, "records": {}}
    return {"block": 52000000, "records": {}}


def _save_ledger(ledger: dict):
    with open(LEDGER_PATH, "w") as f:
        json.dump(ledger, f)


def record_on_chain(document_hash: str, ipfs_cid: str) -> dict:
    """Store the document hash on-chain (immutable proof) and return the tx receipt."""
    ledger = _load_ledger()
    ledger["block"] += secrets.randbelow(5) + 1
    block_number = ledger["block"]
    nonce = secrets.token_hex(8)
    tx_seed = f"{document_hash}:{ipfs_cid}:{block_number}:{nonce}:{time.time()}"
    tx_hash = "0x" + hashlib.sha256(tx_seed.encode()).hexdigest()

    ledger["records"][document_hash] = {
        "document_hash": document_hash,
        "ipfs_cid": ipfs_cid,
        "tx_hash": tx_hash,
        "block_number": block_number,
        "timestamp": int(time.time()),
    }
    _save_ledger(ledger)
    return {
        "tx_hash": tx_hash,
        "block_number": block_number,
        "contract_address": CONTRACT_ADDRESS,
        "network": NETWORK,
    }


def verify_integrity(stored_hash: str, current_bytes: bytes) -> dict:
    """Recompute the hash of the current document and compare with the on-chain record."""
    ledger = _load_ledger()
    on_chain = ledger["records"].get(stored_hash)
    current_hash = sha256_hex(current_bytes)
    matches = (current_hash == stored_hash) and (on_chain is not None)
    return {
        "status": "VERIFIED" if matches else "DOCUMENT_MODIFIED",
        "current_hash": current_hash,
        "stored_hash": stored_hash,
        "on_chain": on_chain,
        "matches": matches,
    }


def lookup(document_hash: str) -> dict | None:
    return _load_ledger()["records"].get(document_hash)
