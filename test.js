var signing_key_1 = require("@ethersproject/signing-key");
var bytes_1 = require("@ethersproject/bytes");
var keccak256_1 = require("@ethersproject/keccak256");
var address_1 = require("@ethersproject/address");
var { keccak256, recoverAddress } = require("ethers/lib/utils");


function computeAddress(key) {
    var publicKey = (0, signing_key_1.computePublicKey)(key);
    return (0, address_1.getAddress)((0, bytes_1.hexDataSlice)((0, keccak256_1.keccak256)((0, bytes_1.hexDataSlice)(publicKey, 1)), 12));
}

function recoverAddress(digest, signature) {
    return computeAddress((0, signing_key_1.recoverPublicKey)((0, bytes_1.arrayify)(digest), signature));
}


const orderHash = await getAndVerifyOrderHash(orderComponents);
const { domainSeparator } = await marketplaceContract.information();
const digest = keccak256(
    `0x1901${domainSeparator.slice(2)}${orderHash.slice(2)}`
);

const recoveredAddress = recoverAddress(digest, signature);

expect(recoveredAddress).to.equal(signer.address);