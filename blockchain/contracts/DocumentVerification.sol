// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocumentVerification
 * @notice Anchors SHA-256 fingerprints of insurance policy documents on-chain for
 *         tamper-evident verification. The full document is NEVER stored on-chain —
 *         only its 32-byte hash plus the IPFS CID where the original file lives.
 *
 * Deploy target: Polygon Amoy Testnet.
 * The VeriTrust backend (app/blockchain.py) mirrors this exact interface with a local
 * EVM-style ledger so the platform works without gas/RPC; swap in a web3 contract call
 * to go fully live — the function signatures and events are identical.
 */
contract DocumentVerification {
    struct Record {
        bytes32 documentHash; // SHA-256 fingerprint of the original document
        string ipfsCid;       // IPFS content identifier of the stored document
        address owner;        // address that registered the record
        uint256 timestamp;    // block timestamp of registration
        bool exists;
    }

    // documentHash => Record
    mapping(bytes32 => Record) private records;

    event DocumentRegistered(
        bytes32 indexed documentHash,
        string ipfsCid,
        address indexed owner,
        uint256 timestamp
    );

    /// @notice Register a document's hash + IPFS CID. Reverts if already registered.
    function registerDocument(bytes32 documentHash, string calldata ipfsCid) external {
        require(!records[documentHash].exists, "Document already registered");
        records[documentHash] = Record({
            documentHash: documentHash,
            ipfsCid: ipfsCid,
            owner: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });
        emit DocumentRegistered(documentHash, ipfsCid, msg.sender, block.timestamp);
    }

    /// @notice Verify integrity: returns true only if the supplied hash matches a record.
    function verifyDocument(bytes32 documentHash) external view returns (bool) {
        return records[documentHash].exists;
    }

    /// @notice Fetch a stored verification record.
    function getRecord(bytes32 documentHash)
        external
        view
        returns (string memory ipfsCid, address owner, uint256 timestamp, bool exists)
    {
        Record storage r = records[documentHash];
        return (r.ipfsCid, r.owner, r.timestamp, r.exists);
    }
}
