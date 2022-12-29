const grpc = require("@grpc/grpc-js")
const crypto = require('crypto')
const { connect, signers } = require("@hyperledger/fabric-gateway")
const fs = require('fs/promises')
const { TextDecoder } = require('util')
const path = require('path')
const utf8Decoder = new TextDecoder()

const channelName = 'mychannel'
const chaincodeName = "token"
const mspId = 'Org1MSP'

const cryptoPath = path.resolve(__dirname, 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com')

console.log(__dirname)

//User дериктория с ключами и сертификатом
const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore')
const certPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem')

const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt')

const peerEndpoint = "localhost:7051"
const peerHostAlias = 'peer0.org1.example.com'


async function main() {
    
    const client = await newGrpcClient()

    const gateway = connect({
        client: client,
        identity: await newIdentity(),
        signer: await newSigner()
    })

    try {
        const network = gateway.getNetwork(channelName)
        const contract = network.getContract(chaincodeName)

        // const putResult = await contract.submitTransaction("Mint", "2000")

        // console.log("Result init", utf8Decoder.decode(putResult))

        const getResult = await contract.evaluateTransaction("ClientAccountID")

        console.log("Result:", utf8Decoder.decode(getResult))
    } finally {
        gateway.close();
        client.close();
    }

}

main().catch(console.error)

async function newGrpcClient() {
    const tlsRootCert = await fs.readFile(tlsCertPath)
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert)
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        "grpc.ssl_target_name_override": peerHostAlias
    })
}

async function newIdentity() {
    const credentials = await fs.readFile(certPath)
    return { mspId, credentials }
}

async function newSigner() {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}