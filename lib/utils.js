const _validation_codes = require('./validation_codes')
const sha = require('js-sha256')

const TokenTypeKey = "TokenType"
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

    async checkTransferToken(tokenType, amount, txId, releId) {
        var transaction = await queryTxFromLedger(this.ctx, txId)

        console.log(transaction)

        if(transaction) {
            if(transaction.validation_code == "VALID") {
                const event = transaction.event
                if(event.chaincode_id == tokenType) {
                    if(event.payload.to == releId) {
                        if(BigInt(event.payload.value) == BigInt(amount)) {
                            return true
                        }
                    }
                }
            }
        }
        return false
    }

}

async function queryTxFromLedger(ctx, txId) {
    try {
        const txn = await ctx.stub.invokeChaincode("qscc", ["GetTransactionByID", ctx.stub.getChannelID(), txId], ctx.stub.getChannelID())
        if(txn) {
            const txObj = txn.transactionEnvelope;
            const txStr = JSON.stringify(txObj);
            let txid = txObj.payload.header.channel_header.tx_id;
            let validation_code = '';
            let payload_proposal_hash = '';
            let chaincode = '';
            let rwset;
            let readSet;
            let writeSet;
            let chaincodeID;
            let mspId = [];

            convertFormatOfValue(
                'value',
                "utf8",
                txObj
            )

            if (txid && txid !== '') {
                const val_code = txn.validationCode
                validation_code = convertValidationCode(val_code)
            }

            if (txObj.payload.data.actions !== undefined) {
                chaincode =
                    txObj.payload.data.actions[0].payload.action.proposal_response_payload
                        .extension.chaincode_id.name
                chaincodeID = new Uint8Array(
                    txObj.payload.data.actions[0].payload.action.proposal_response_payload.extension
                )
                mspId = txObj.payload.data.actions[0].payload.action.endorsements.map(
                    endorsement => endorsement.endorser.mspid
                )
                rwset =
                    txObj.payload.data.actions[0].payload.action.proposal_response_payload
                        .extension.results.ns_rwset

                readSet = rwset.map(rw => ({
                    chaincode: rw.namespace,
                    set: rw.rwset.reads
                }))

                writeSet = rwset.map(rw => ({
                    chaincode: rw.namespace,
                    set: rw.rwset.writes
                }))

                payload_proposal_hash = txObj.payload.data.actions[0].payload.action.proposal_response_payload.proposal_hash.toString(
                    'hex'
                )
            }
            if (txObj.payload.header.channel_header.typeString === 'CONFIG') {
                txid = sha.sha256(txStr)
                readSet =
                    txObj.payload.data.last_update.payload?.data.config_update.read_set
                writeSet =
                    txObj.payload.data.last_update.payload?.data.config_update.write_set
            }

            const events = txObj.payload.data.actions[0].payload.action.proposal_response_payload.extension.events
            const event = {
                chaincode_id: events.chaincode_id,
                tx_id: events.tx_id,
                event_name: events.event_name,
                payload: JSON.parse(events.payload.toString())
            }

            const chaincode_id = String.fromCharCode.apply(null, chaincodeID)
            const transaction = {
                channel_name: this.defaultChannelName,
                txhash: txid,
                createdt: txObj.payload.header.channel_header.timestamp,
                chaincodename: chaincode,
                chaincode_id,
                creator_msp_id: txObj.payload.header.signature_header.creator.mspid,
                endorser_msp_id: mspId,
                type: txObj.payload.header.channel_header.typeString,
                readSet,
                writeSet,
                validation_code,
                payload_proposal_hash,
                event
            }
            return transaction
        }
        return txn
    } catch(error) {
        console.log(error)
        return null
    }


}

function convertValidationCode(code) {
	if (typeof code === 'string') {
		return code;
	}
	return _validation_codes[code];
}

function convertFormatOfValue(prop, encoding, obj) {
    if (Array.isArray(obj)) {
        for (let idx = 0; idx < obj.length; idx++) {
            convertFormatOfValue(prop, encoding, obj[idx]);
        }
    } else if (!Buffer.isBuffer(obj) && typeof obj === 'object') {
        // Each element of array of Buffer is excluded by the 1st condition
        Object.keys(obj).forEach(key => {
            if (key === prop && Buffer.isBuffer(obj[key])) {
                obj[key] = obj[key].toString(encoding);
            } else if (obj[key]) {
                convertFormatOfValue(prop, encoding, obj[key]);
            }
        });
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