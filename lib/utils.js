const TokenTypeKey = "TokenType"
const regAddr = /0:([0-9]|[a-f]){64,64}/

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

    async newTokenType(tokenType) {
        var checkTokenType = await validationTokenType(this.ctx, tokenType)

        if(checkTokenType) {
            return false
        }

        var tokenTypeKey = this.ctx.stub.createCompositeKey(TokenTypeKey, [tokenType])

        await this.ctx.stub.putState(tokenTypeKey, Buffer.from(tokenType))

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
    if(addr.length == 66) {
        var checkAddr = regAddr.test(addr)
        return checkAddr;
    }
    return false
}

module.exports = Utils