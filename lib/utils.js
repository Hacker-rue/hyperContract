const TokenTypeKey = "TokenType"
const TransferTokensKey = "TransferTokensKey"
const regAddr = /([0-9]|[a-f]){64,64}/

class Utils {

    constructor(ctx) {
        this.ctx = ctx
    }

    async checkValues(to, amount, TokenType) {
        var checkAddr = validationAddr(to)
        var checkAmount = validationAmount(amount)
        var checkTokenType = await validationTokenType(this.ctx, TokenType)

        return {
            checkAddr,
            checkAmount,
            checkTokenType
        }
    }

    async getToken(tokenName) {
        const tokenTypeKey = this.ctx.stub.createCompositeKey(TokenTypeKey, [tokenName])

        const token = await this.ctx.stub.getState(tokenTypeKey)

        if(!token || token.length === 0) {
            throw Error("TokenType undefined")
        }
        return token.toString()
    }

    async getAllToken() {
        const allResults = [];
        
        const iterator = await this.ctx.stub.getStateByPartialCompositeKey(TokenTypeKey, [])
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

    async addTxIdTransferTokens(txIDTransfer, txIDVault) {
        var key = this.ctx.stub.createCompositeKey(TransferTokensKey, [txIDTransfer])
    
        var _txId = await this.ctx.stub.getState(key)
        if(!_txId || _txId.length === 0) {
            await this.ctx.stub.putState(key, Buffer.from(txIDVault))
            return true
        }
        return false
    }

    async getTxIDVault(txIDTransfer) {
        var key = this.ctx.stub.createCompositeKey(TransferTokensKey, [txIDTransfer])

        var _txID = await this.ctx.stub.getState(key)
        if(!_txID || _txID.length === 0) {
            return null
        }
        return _txID.toString()
    }

    async newTokenType(tokenType, type) {
        var checkTokenType = await validationTokenType(this.ctx, tokenType)

        if(checkTokenType) {
            return false
        }

        var tokenTypeKey = this.ctx.stub.createCompositeKey(TokenTypeKey, [tokenType])

        await this.ctx.stub.putState(tokenTypeKey, Buffer.from(JSON.stringify({
            tokenName: tokenType,
            type: type 
        })))

        return true
    }

}

async function validationTokenType(ctx, tokenType) {
    var tokenTypeKey = ctx.stub.createCompositeKey(TokenTypeKey, [tokenType])
    var TokenType = await ctx.stub.getState(tokenTypeKey)

    if(!TokenType || TokenType.length === 0) {
        return false
    }
    return true
}

function validationAmount(amount) {
    var checkAmount = parseInt(amount)
    if(checkAmount > 0) {
        return true
    }
    return false
}

function validationAddr(addr) {
    try {
        // if(addr.length == 66) {
        //     var str = addr.split(":")
        //     var checkAddr = regAddr.test(str[1])
        //     return checkAddr;
        // }
        // return false
        return true
    } catch {
        return false
    }
    
}

module.exports = Utils