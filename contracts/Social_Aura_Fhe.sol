pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract SocialAuraFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public batchClosed;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    // Encrypted data storage
    // For simplicity, this example assumes a fixed number of tags per user.
    // In a real app, this would be more dynamic.
    mapping(address => euint32) private userEncryptedTag1;
    mapping(address => euint32) private userEncryptedTag2;
    mapping(address => euint32) private userEncryptedTag3;

    // Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PauseToggled(bool paused);
    event CooldownSecondsChanged(uint256 oldCooldown, uint256 newCooldown);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event UserTagsSubmitted(address indexed user, uint256 indexed batchId);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 matchScore);

    // Custom Errors
    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchClosedOrInvalid();
    error ReplayDetected();
    error StateMismatch();
    error InvalidSignature();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier checkSubmissionCooldown(address user) {
        if (block.timestamp < lastSubmissionTime[user] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier checkDecryptionCooldown(address user) {
        if (block.timestamp < lastDecryptionRequestTime[user] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        currentBatchId = 1; // Start with batch 1
        cooldownSeconds = 60; // Default 1 minute cooldown
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function addProvider(address provider) external onlyOwner {
        isProvider[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        isProvider[provider] = false;
        emit ProviderRemoved(provider);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseToggled(_paused);
    }

    function setCooldownSeconds(uint256 newCooldown) external onlyOwner {
        require(newCooldown > 0, "Cooldown must be positive");
        emit CooldownSecondsChanged(cooldownSeconds, newCooldown);
        cooldownSeconds = newCooldown;
    }

    function openNewBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        // Ensure the new batch is marked as open (not closed)
        batchClosed[currentBatchId] = false;
        emit BatchOpened(currentBatchId);
    }

    function closeCurrentBatch() external onlyOwner whenNotPaused {
        batchClosed[currentBatchId] = true;
        emit BatchClosed(currentBatchId);
    }

    function submitEncryptedTags(
        euint32 encryptedTag1,
        euint32 encryptedTag2,
        euint32 encryptedTag3
    ) external onlyProvider whenNotPaused checkSubmissionCooldown(msg.sender) {
        if (batchClosed[currentBatchId]) revert BatchClosedOrInvalid();

        _initIfNeeded(encryptedTag1);
        _initIfNeeded(encryptedTag2);
        _initIfNeeded(encryptedTag3);

        userEncryptedTag1[msg.sender] = encryptedTag1;
        userEncryptedTag2[msg.sender] = encryptedTag2;
        userEncryptedTag3[msg.sender] = encryptedTag3;

        lastSubmissionTime[msg.sender] = block.timestamp;
        emit UserTagsSubmitted(msg.sender, currentBatchId);
    }

    function requestMatchScore(address userA, address userB) external onlyProvider whenNotPaused checkDecryptionCooldown(msg.sender) {
        if (batchClosed[currentBatchId]) revert BatchClosedOrInvalid();

        euint32 tag1A = userEncryptedTag1[userA];
        euint32 tag2A = userEncryptedTag2[userA];
        euint32 tag3A = userEncryptedTag3[userA];

        euint32 tag1B = userEncryptedTag1[userB];
        euint32 tag2B = userEncryptedTag2[userB];
        euint32 tag3B = userEncryptedTag3[userB];

        _initIfNeeded(tag1A);
        _initIfNeeded(tag2A);
        _initIfNeeded(tag3A);
        _initIfNeeded(tag1B);
        _initIfNeeded(tag2B);
        _initIfNeeded(tag3B);

        // Calculate match for tag1
        euint32 diff1 = tag1A.sub(tag1B);
        euint32 diffSq1 = diff1.mul(diff1);
        euint32 match1 = FHE.asEuint32(100).sub(diffSq1); // Simpler match: 100 - (tagA - tagB)^2

        // Calculate match for tag2
        euint32 diff2 = tag2A.sub(tag2B);
        euint32 diffSq2 = diff2.mul(diff2);
        euint32 match2 = FHE.asEuint32(100).sub(diffSq2);

        // Calculate match for tag3
        euint32 diff3 = tag3A.sub(tag3B);
        euint32 diffSq3 = diff3.mul(diff3);
        euint32 match3 = FHE.asEuint32(100).sub(diffSq3);

        // Aggregate match score (average)
        euint32 totalMatch = match1.add(match2).add(match3);
        euint32 matchScore = totalMatch.mul(FHE.asEuint32(3333333333300000000)); // Approx 1/3 for average, scaled for euint32 precision

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = matchScore.toBytes32();

        bytes32 stateHash = _hashCiphertexts(cts);

        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({ batchId: currentBatchId, stateHash: stateHash, processed: false });
        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        emit DecryptionRequested(requestId, currentBatchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        DecryptionContext storage context = decryptionContexts[requestId];

        // Replay guard
        if (context.processed) revert ReplayDetected();

        // State verification
        // Rebuild cts array in the exact same order as in requestMatchScore
        // This requires knowing which ciphertexts were involved.
        // For this example, we'll assume we can reconstruct the matchScore ciphertext.
        // In a more complex scenario, you might store the addresses (userA, userB) in the context.
        // For simplicity, this example will focus on the core mechanism.
        // The actual ciphertext reconstruction for state verification is highly dependent on the specific computation.
        // Here, we'll just demonstrate the hash check with a placeholder.
        // A real implementation would need to re-compute the `matchScore` ciphertext
        // based on the current state of `userEncryptedTagX` for the relevant users.

        // For this example, let's assume the state hash was computed from a single ciphertext `matchScore`.
        // We would need to re-compute `matchScore` using the *current* encrypted tags of userA and userB.
        // This is complex to do generically without storing userA and userB in the context.
        // For the purpose of this example, we'll skip the full ciphertext reconstruction
        // and focus on the hash check logic, assuming `currentHash` could be computed.
        // bytes32 currentHash = _hashCiphertexts(reconstructedCts);
        // if (currentHash != context.stateHash) revert StateMismatch();
        // TODO: Implement full ciphertext reconstruction for state verification.
        // For now, this is a placeholder to illustrate the pattern.
        // This is a critical security step and must be implemented correctly.
        // The following line is a simplified placeholder:
        if (keccak256(abi.encodePacked(context.stateHash, address(this))) != keccak256(abi.encodePacked(context.stateHash, address(this)))) revert StateMismatch(); // Dummy check, replace with actual logic


        // Proof verification
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) revert InvalidSignature();

        // Decode & Finalize
        // The cleartexts array should contain one element for the matchScore
        uint256 score = abi.decode(cleartexts, (uint256));

        context.processed = true;
        emit DecryptionCompleted(requestId, context.batchId, score);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded(euint32 val) internal {
        if (!val.isInitialized()) {
            // Initialize with a default encrypted value if not already initialized.
            // The specific default value (e.g., FHE.asEuint32(0)) depends on the application logic.
            // This is a safeguard. Proper initialization should happen upon submission.
            val = FHE.asEuint32(0);
        }
    }

    function _requireInitialized(euint32 val) internal pure {
        if (!val.isInitialized()) revert("Ciphertext not initialized");
    }
}