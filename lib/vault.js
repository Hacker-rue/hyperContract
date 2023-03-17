const { Contract, Context } = require("fabric-contract-api")
const Utils = require('./utils.js')


const ReleId = "x509::/C=US/ST=North Carolina/O=Hyperledger/OU=admin/CN=org1admin::/C=US/ST=North Carolina/L=Durham/O=org1.example.com/CN=ca.org1.example.com"

const TransferKey = "TransferKey"
const UserTransfersKey = "UserTransfersKey"

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

    async newTransfer(ctx, from, to, amount, TokenType, TxId) {
        const checkResult = await ctx.utils.checkValues(to, amount, TokenType)

        if(!checkResult.checkAmount) {
            throw new Error("Error: amount")
        } else if(!checkResult.checkTokenType) {
            throw new Error("Error: TokenType")
        }

        var addr
        var type

        if(from == "") {
            addr = ctx.clientIdentity.getID()
            type = 1
        } else {
            addr = from
            type = 2
        }

        var transfer = {
            txIdTransfer: ctx.stub.getTxID(),
            from: addr,
            to: to,
            tokenType: TokenType,
            txIdTransferToken: TxId,
            amount: parseInt(amount),
            eventAddress: "",
            typeTransfer: type,
            createDate: ctx.stub.getDateTimestamp().getTime(),
            completionDate: 0,
            status: "created"
        }

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [ctx.stub.getTxID()])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        var userTransfersKey = ctx.stub.createCompositeKey(UserTransfersKey, [ctx.clientIdentity.getID()])

        var userTransfers = await ctx.stub.getState(userTransfersKey)

        if(!userTransfers || userTransfers.length === 0) {
            userTransfers = {
                accountId: ctx.clientIdentity.getID(),
                transfers: [ctx.stub.getTxID()]
            }
        } else {
            userTransfers = JSON.parse(userTransfers.toString())
            userTransfers.transfers.push(ctx.stub.getTxID())
        }

        await ctx.stub.putState(userTransfersKey, Buffer.from(JSON.stringify(userTransfers)))

        ctx.stub.setEvent("Transfer", Buffer.from(JSON.stringify({
            txIdTransfer: ctx.stub.getTxID(),
            from: addr,
            to: to,
            tokenType: TokenType,
            txIdTransferToken: TxId,
            amount: parseInt(amount),
            typeTransfer: type,
            createDate: ctx.stub.getDateTimestamp().getTime(),
            completionDate: 0,
        })))

        return JSON.stringify(transfer)
    }

    async addTransferTxId(ctx, txId, transferTxId) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, txId))

        transfer.txIdTransferToken = transferTxId

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [txId])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        return true
    }

    async addTransferEventAddr(ctx, txId, eventAddr) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, txId))

        transfer.eventAddress = eventAddr

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [txId])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        return true
    }

    async getTransfer(ctx, txId) {
        const transferKey = ctx.stub.createCompositeKey(TransferKey, [txId])

        const transfer = await ctx.stub.getState(transferKey)

        if(!transfer || transfer.length === 0) {
            throw new Error(`Applications under the number: ${txId}, does not exist`)
        }

        return transfer.toString()
    }

    async getUserTransfersId(ctx) {
        const userTransfersKey = ctx.stub.createCompositeKey(UserTransfersKey, [ctx.clientIdentity.getID()])
        const userTransfers = await ctx.stub.getState(userTransfersKey)

        if(!userTransfers || userTransfers.length === 0) {
            throw new Error(`You don't have any applications to view`)
        }

        return userTransfers.toString()
    }

    async getAllTransfer(ctx) {
        const allResults = [];
        
        const iterator = await ctx.stub.getStateByPartialCompositeKey(TransferKey, [])
        let result = await iterator.next()
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8')
            let record
            try {
                record = JSON.parse(strValue)
            } catch (err) {
                console.log(err)
                record = strValue
            }
            allResults.push(record)
            result = await iterator.next()
        }
        return JSON.stringify(allResults)
    }

    async getAllToken(ctx) {
        return await ctx.utils.getAllToken()
    }

    async setStatusProcessing(ctx, txId) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, txId))

        transfer.status = "processing"

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [txId])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        ctx.stub.setEvent("StatusTransfer", Buffer.from(JSON.stringify({
            txIdTransfer: txId,
            status: "processing"
        })))
    }

    async setStatusCompleted(ctx, txId) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, txId))

        transfer.completionDate = ctx.stub.getDateTimestamp().getTime()
        transfer.status = "completed"

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [txId])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        ctx.stub.setEvent("StatusTransfer", Buffer.from(JSON.stringify({
            txIdTransfer: txId,
            status: "completed"
        })))
    }

    async setStatusRejected(ctx, txId) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId != ReleId) {
            throw new Error("Client identity")
        }

        var transfer = JSON.parse(await this.getTransfer(ctx, txId))

        transfer.completionDate = ctx.stub.getDateTimestamp().getTime()
        transfer.status = "rejected"

        var transferKey = ctx.stub.createCompositeKey(TransferKey, [txId])
        await ctx.stub.putState(transferKey, Buffer.from(JSON.stringify(transfer)))

        ctx.stub.setEvent("StatusTransfer", Buffer.from(JSON.stringify({
            txIdTransfer: txId,
            status: "rejected"
        })))
    }

    async getReleId(ctx) {
        return ReleId
    }

    async getTokenType(ctx, tokenName) {
        var token = await ctx.utils.getToken(tokenName)
        return token
    }

    async newTokenType(ctx, tokenName, type) {
        var clientId = ctx.clientIdentity.getID()

        if(clientId == ReleId) {
            var result = await ctx.utils.newTokenType(tokenName, type)
            return result
        } else {
            throw new Error("Client identity")
        }
    }

}

module.exports = VaultContract