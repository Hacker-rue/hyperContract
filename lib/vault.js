const { Contract, Context } = require("fabric-contract-api")
const { ChaincodeProposal } = require("fabric-shim")
const Utils = require('./utils.js')


const ReleId = "x509::/C=US/ST=North Carolina/O=Hyperledger/OU=admin/CN=org1admin::/C=US/ST=North Carolina/L=Durham/O=org1.example.com/CN=ca.org1.example.com"

const NumberTransferKey = "NumberTransferKey"
const TransferKey = "TransferKey"

class VaultContext extends Context {
    
    constructor() {
        super()
        this.utils = new Utils(this)
    }

}


class VaultContract extends Contract {


    createContext() {
        return new VaultContext()
    }

    async newTransfer(ctx, to, amount, TokenType, TxId) {
        const checkResult = await ctx.utils.checkValues(to, amount, TokenType)

        if(!checkResult.checkAddr) {
            throw new Error("Error: addr")
        } else if(!checkResult.checkAmount) {
            throw new Error("Error: amount")
        } else if(!checkResult.checkTokenType) {
            throw new Error("Error: TokenType")
        }

        const numberTransferBytes = await ctx.stub.getState(NumberTransferKey)

        var numberTransfer

        if (!numberTransferBytes || numberTransferBytes.length === 0) {
            numberTransfer = 1
        } else {
            numberTransfer = numberTransferBytes.toString()
            numberTransfer = parseInt(numberTransfer)
        }

        var transfer = {
            number: numberTransfer,
            from: ctx.clientIdentity.getID(),
            to: to,
            tokenType: TokenType,
            txId: TxId,
            amount: parseInt(amount),
            status: "created"
        }

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [numberTransfer.toString()])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify({
            number: numberTransfer,
            from: ctx.clientIdentity.getID(),
            to: to,
            amount: parseInt(amount),
            tokenType: TokenType,
            txId: TxId
        })))

        console.log(numberTransfer.toString())

        numberTransfer++

        await ctx.stub.putState(NumberTransferKey, Buffer.from(numberTransfer.toString()))

        return JSON.stringify(transfer)
    }

    async getTransfer(ctx, number) {
        const transferKey = ctx.stub.createCompositeKey(TransferKey, [number])

        const transfer = await ctx.stub.getState(transferKey)

        if(!transfer || transfer.length === 0) {
            throw new Error(`Applications under the number: ${number}, does not exist`)
        }

        return transfer.toString()
    }

    async setStatusProcessing(ctx, number) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, number))

        transfer.status = "processing"

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [number])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        ctx.stub.setEvent("StatusTransfer", Buffer.from(JSON.stringify({
            number: number,
            status: "processing"
        })))
    }

    async setStatusCompleted(ctx, number) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, number))

        transfer.status = "completed"

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [number])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        ctx.stub.setEvent("StatusTransfer", Buffer.from(JSON.stringify({
            number: number,
            status: "completed"
        })))
    }

    async setStatusRejected(ctx, number) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, number))

        transfer.status = "rejected"

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [number])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        ctx.stub.setEvent("StatusTransfer", Buffer.from(JSON.stringify({
            number: number,
            status: "rejected"
        })))
    }

    async getReleId(ctx) {
        return ReleId
    }

    async newTokenType(ctx, tokenType) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId == ReleId) {
            var result = await ctx.utils.newTokenType(tokenType)
            return result
        } else {
            throw new Error("Client identity")
        }
    }

}

module.exports = VaultContract