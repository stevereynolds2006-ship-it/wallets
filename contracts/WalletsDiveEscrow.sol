// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title WALLETS dive escrow
/// @notice Holds a 25 RF stake for one dive. A signed clear run returns 12.5 RF to the player.
///         The other half, and every failed stake, stays here for the owner to withdraw.
/// @dev The player cannot declare their own win. `settler` must sign the result, or call
///      `settle` itself. Do not put the settler key in the website.
///
///      Robinhood Chain (4663).
///      RF token: 0x0779369854d3EcdEA927206718FFD7730C67B71f
///
///      Deploy from Remix (compiler 0.8.28, optimizer off is fine):
///        token   = 0x0779369854d3EcdEA927206718FFD7730C67B71f
///        settler = the address that will sign results (not a key stored in the page)
///        owner   = the address that can withdraw the house share
///
///      Player: approve this contract for 25 RF, then stake(diveId).
///      Settler signs the EIP-712 Settle struct. Anyone may relay that signature.
///      After 7 days with no result, anyone may return the full stake to the player.
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract WalletsDiveEscrow {
    uint256 public constant STAKE = 25 ether;
    uint256 public constant REFUND = STAKE / 2;
    uint256 public constant RECLAIM_AFTER = 7 days;

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant SETTLE_TYPEHASH =
        keccak256("Settle(bytes32 diveId,address player,bool won,uint256 deadline)");
    bytes32 private constant NAME_HASH = keccak256("WALLETS");
    bytes32 private constant VERSION_HASH = keccak256("1");
    uint256 private constant SECP256K1N_HALF =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    struct Dive {
        address player;
        uint64 openedAt;
        bool open;
    }

    IERC20 public immutable token;
    address public immutable settler;
    address public immutable owner;

    mapping(bytes32 => Dive) public dives;
    uint256 public locked;

    uint256 private entered;

    event Staked(bytes32 indexed diveId, address indexed player, uint256 amount);
    event Settled(bytes32 indexed diveId, address indexed player, bool won, uint256 refund);
    event Reclaimed(bytes32 indexed diveId, address indexed player, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAddress();
    error BadDive();
    error NotOpen();
    error TooSoon();
    error NotSettler();
    error NotOwner();
    error BadSignature();
    error Expired();
    error LockedFunds();
    error ShortStake();
    error TokenFailed();
    error Reentered();

    modifier nonReentrant() {
        if (entered == 1) revert Reentered();
        entered = 1;
        _;
        entered = 0;
    }

    constructor(address token_, address settler_, address owner_) {
        if (token_ == address(0) || settler_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = IERC20(token_);
        settler = settler_;
        owner = owner_;
    }

    /// @notice Pull 25 RF from the caller and open a dive. `diveId` must be unused.
    function stake(bytes32 diveId) external nonReentrant {
        if (diveId == bytes32(0)) revert BadDive();
        if (dives[diveId].player != address(0)) revert BadDive();
        uint256 beforeBal = token.balanceOf(address(this));
        _call(address(token), abi.encodeCall(IERC20.transferFrom, (msg.sender, address(this), STAKE)));
        if (token.balanceOf(address(this)) - beforeBal != STAKE) revert ShortStake();
        dives[diveId] = Dive({player: msg.sender, openedAt: uint64(block.timestamp), open: true});
        locked += STAKE;
        emit Staked(diveId, msg.sender, STAKE);
    }

    /// @notice Settler closes a dive. A win sends 12.5 RF back to the player.
    function settle(bytes32 diveId, bool won) external nonReentrant {
        if (msg.sender != settler) revert NotSettler();
        _close(diveId, won);
    }

    /// @notice Anyone can submit the settler's EIP-712 signature. The player usually pays this gas.
    function relay(bytes32 diveId, bool won, uint256 deadline, bytes calldata signature) external nonReentrant {
        if (block.timestamp > deadline) revert Expired();
        Dive storage dive = dives[diveId];
        if (!dive.open) revert NotOpen();
        bytes32 digest = settlementHash(diveId, dive.player, won, deadline);
        if (_recover(digest, signature) != settler) revert BadSignature();
        _close(diveId, won);
    }

    /// @notice Full refund if the settler never closes the dive. Does not let the player self-declare a win.
    function reclaim(bytes32 diveId) external nonReentrant {
        Dive storage dive = dives[diveId];
        if (!dive.open) revert NotOpen();
        if (block.timestamp < uint256(dive.openedAt) + RECLAIM_AFTER) revert TooSoon();
        address player = dive.player;
        dive.open = false;
        locked -= STAKE;
        _call(address(token), abi.encodeCall(IERC20.transfer, (player, STAKE)));
        emit Reclaimed(diveId, player, STAKE);
    }

    /// @notice Owner withdraws only the settled house share. Open stakes stay locked.
    function withdraw(address to, uint256 amount) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        uint256 free = token.balanceOf(address(this)) - locked;
        if (amount > free) revert LockedFunds();
        _call(address(token), abi.encodeCall(IERC20.transfer, (to, amount)));
        emit Withdrawn(to, amount);
    }

    function settlementHash(bytes32 diveId, address player, bool won, uint256 deadline) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(SETTLE_TYPEHASH, diveId, player, won, deadline));
        bytes32 domain = keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function _close(bytes32 diveId, bool won) private {
        Dive storage dive = dives[diveId];
        if (!dive.open) revert NotOpen();
        address player = dive.player;
        dive.open = false;
        locked -= STAKE;
        uint256 refund = won ? REFUND : 0;
        if (refund != 0) _call(address(token), abi.encodeCall(IERC20.transfer, (player, refund)));
        emit Settled(diveId, player, won, refund);
    }

    function _call(address target, bytes memory data) private {
        (bool ok, bytes memory ret) = target.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TokenFailed();
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert BadSignature();
        bytes32 r;
        bytes32 s;
        uint256 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert BadSignature();
        if (uint256(s) > SECP256K1N_HALF) revert BadSignature();
        address signer = ecrecover(digest, uint8(v), r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}
