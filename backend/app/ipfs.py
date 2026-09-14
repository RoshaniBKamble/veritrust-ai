"""Local IPFS-compatible object store.

Generates a REAL IPFS CIDv0 (base58btc of the sha2-256 multihash of the content),
identical in format to what a live IPFS node would return, and stores the bytes so
the original document is retrievable via its CID.
"""
import os
import hashlib
import base58

STORAGE_DIR = os.environ.get("IPFS_STORAGE_DIR", "/app/backend/ipfs_store")
os.makedirs(STORAGE_DIR, exist_ok=True)


def compute_cid(data: bytes) -> str:
    """CIDv0 = base58btc( 0x12 0x20 <sha256(data)> )  -> starts with 'Qm'."""
    digest = hashlib.sha256(data).digest()
    multihash = b"\x12\x20" + digest  # 0x12 = sha2-256, 0x20 = 32-byte length
    return base58.b58encode(multihash).decode("utf-8")


def add(data: bytes) -> str:
    cid = compute_cid(data)
    path = os.path.join(STORAGE_DIR, cid)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(data)
    return cid


def get(cid: str) -> bytes | None:
    path = os.path.join(STORAGE_DIR, cid)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    return None
