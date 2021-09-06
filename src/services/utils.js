// import dataUriToBuffer from 'data-uri-to-buffer'
import {
  hexToCV, cvToJSON
} from '@stacks/transactions'
import dataUriToBuffer from 'data-uri-to-buffer'
import crypto from 'crypto'
import { c32address, c32addressDecode } from 'c32check'

const precision = 1000000

const utils = {
  convertAddress: function (network, b160Address) {
    let version = 26
    if (network === 'mainnet') version = 22
    const address = c32address(version, b160Address) // 22 for mainnet
    return address
  },
  convertAddressFrom: function (stxAddress) {
    if (!stxAddress) return '?'
    const decoded = c32addressDecode(stxAddress)
    return decoded
  },
  buildHash: function (hashable) {
    return crypto.createHash('sha256').update(hashable).digest('hex')
  },
  copyAddress: function (document, flasher, target) {
    const tempInput = document.createElement('input')
    tempInput.style = 'position: absolute; left: -1000px; top: -1000px'
    tempInput.value = target
    document.body.appendChild(tempInput)
    tempInput.select()
    document.execCommand('copy')
    document.body.removeChild(tempInput)
    flasher.classList.add('flasher')
    setTimeout(function () {
      flasher.classList.remove('flasher')
    }, 1000)
  },
  makeFlasher: function (flasher) {
    flasher.classList.add('flasher')
    setTimeout(function () {
      flasher.classList.remove('flasher')
      setTimeout(function () {
        flasher.classList.add('flasher')
        setTimeout(function () {
          flasher.classList.remove('flasher')
          setTimeout(function () {
            flasher.classList.add('flasher')
            setTimeout(function () {
              flasher.classList.remove('flasher')
            }, 300)
          }, 300)
        }, 300)
      }, 300)
    }, 300)
  },
  getFileExtension: function (filename, type) {
    if (filename && filename.lastIndexOf('.') > 0) {
      const index = filename.lastIndexOf('.')
      return filename.substring(index + 1).toLowerCase()
    } else if (type) {
      const index = type.lastIndexOf('/') + 1
      return '.' + type.substring(index).toLowerCase()
    }
  },
  getFileNameNoExtension: function (filename) {
    if (filename && filename.lastIndexOf('.') > 0) {
      const index = filename.lastIndexOf('.')
      return filename.substring(index + 1)
    }
    return ''
  },
  fromMicroAmount: function (amountMicroStx) {
    try {
      if (amountMicroStx === 0) return 0
      const val = Math.round(amountMicroStx) / (precision)
      return val
    } catch {
      return 0
    }
  },
  toDecimals: function (amount, precision) {
    if (!precision) precision = 100
    if (!amount) return
    if (typeof amount === 'string') {
      amount = Number(amount)
    }
    return Math.round(amount * precision) / precision // amount.toFixed(2)
  },
  fromOnChainAmount: function (amountMicroStx) {
    try {
      amountMicroStx = parseInt(amountMicroStx, 16)
      if (typeof amountMicroStx === 'string') {
        amountMicroStx = Number(amountMicroStx)
      }
      if (amountMicroStx === 0) return 0
      amountMicroStx = amountMicroStx / precision
      return Math.round(amountMicroStx * precision) / precision
    } catch {
      return 0
    }
  },
  toOnChainAmount: function (amount) {
    try {
      amount = amount * precision
      return Math.round(amount * precision) / precision
    } catch {
      return 0
    }
  },
  /**
  fetchBase64FromImageUrl: function (url, document) {
    return new Promise((resolve) => {
      const img = new Image()
      img.setAttribute('crossOrigin', 'anonymous')
      img.onload = function () {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(this, 0, 0)
        const dataURL = canvas.toDataURL('image/png')
        const mimeType = dataURL.substring(dataURL.indexOf(':') + 1, dataURL.indexOf(';')) // => image/png
        const imageBuffer = dataUriToBuffer(dataURL)
        resolve({ dataURL: dataURL, imageBuffer: imageBuffer, mimeType: mimeType })
      }
      img.src = url
    })
  },
  **/
  getBase64FromImageUrl: function (dataURL) {
    const imageBuffer = dataUriToBuffer(dataURL)
    // const rawImage = dataURL.replace(/^data:image\/(png|jpg);base64,/, '')
    const mimeType = dataURL.substring(dataURL.indexOf(':') + 1, dataURL.indexOf(';')) // => image/png
    return { imageBuffer: imageBuffer, mimeType: mimeType }
  },
  stringToHex: function (str) {
    const arr = []
    for (let i = 0; i < str.length; i++) {
      arr[i] = (str.charCodeAt(i).toString(16)).slice(-4)
    }
    return '0x' + arr.join('')
  },
  nftIndexFromArgs: function (functionArgs) {
    try {
      if (functionArgs && functionArgs.length > 0) {
        return cvToJSON(functionArgs[0])
      }
    } catch (e) {
      return null
    }
  },
  jsonFromTxResult: function (tx) {
    if (!tx || !tx.tx_result) return null
    return cvToJSON(hexToCV(tx.tx_result.hex))
  },
  fromHex: function (method, rawResponse, strResponse) {
    const jsonResult = cvToJSON(hexToCV(tx.tx_result.hex))
    console.log(jsonResult)
    if (method === 'mint-token' || method === 'mint-edition') {
      try {
        if (strResponse.indexOf('(ok u') > -1) {
          const v1 = strResponse.split(' u')[1]
          const v2 = v1.split(')')[0]
          return Number(v2)
        } else {
          return cvToJSON(hexToCV(rawResponse))
        }
      } catch (e) {
        return -1
      }
    }
    const td = new TextDecoder('utf-8')
    if (!rawResponse) {
      throw new Error('No response from blockchain - is the project deployed?')
    }
    const res = hexToCV(rawResponse)
    if (rawResponse.startsWith('0x08')) {
      return 'error'
    }
    if (method === 'get-mint-price') {
      return res.value.value.toNumber()
    } else if (method === 'set-sale-data') {
      return strResponse.indexOf('(ok u') > -1
    } else if (method === 'get-balance') {
      return res.value.value.toNumber()
    } else if (method === 'get-mint-counter') {
      return res.value.value.toNumber()
    } else if (method === 'get-app-counter') {
      return res.value.value.toNumber()
    } else if (method === 'get-app') {
      return {
        // owner: td.decode(res.value.data.owner.buffer),
        contractId: td.decode(res.value.data['app-contract-id'].buffer),
        gaiaRootPath: td.decode(res.value.data['gaia-root-path'].buffer),
        status: res.value.data.status.value.toNumber(),
        storageModel: res.value.data['storage-model'].value.toNumber()
      }
    } else if (method === 'get-token-by-index' || method === 'get-token-by-hash' || method === 'get-edition-by-hash') {
      const clarityAsset = {}
      const tokenData = res.value.value.data
      clarityAsset.nftIndex = tokenData.nftIndex.value.toNumber()
      clarityAsset.editionCounter = tokenData.editionCounter.value.toNumber()
      clarityAsset.transferCounter = tokenData.transferCounter.value.toNumber()
      clarityAsset.highBidCounter = tokenData.bidCounter.value.toNumber()
      clarityAsset.offerCounter = tokenData.offerCounter.value.toNumber()
      if (tokenData.owner) {
        clarityAsset.owner = tokenData.owner.address.hash160
      }
      clarityAsset.saleData = {
        saleType: 0,
        buyNowOrStartingPrice: 0,
        incrementPrice: 0,
        reservePrice: 0,
        biddingEndTime: 0,
        auctionId: 0
      }
      if (tokenData.saleData) {
        const saleData = tokenData.saleData
        if (saleData.value) {
          const saleData = {}
          saleData.biddingEndTime = saleData.value.data['bidding-end-time'].value.toNumber()
          saleData.incrementPrice = this.fromMicroAmount(saleData.value.data['increment-stx'].value.toNumber())
          saleData.reservePrice = this.fromMicroAmount(saleData.value.data['reserve-stx'].value.toNumber())
          saleData.buyNowOrStartingPrice = this.fromMicroAmount(saleData.value.data['amount-stx'].value.toNumber())
          saleData.saleType = saleData.value.data['sale-type'].value.toNumber()
          saleData.saleCycle = saleData.value.data['sale-cycle-index'].value.toNumber()
          clarityAsset.saleData = saleData
        }
      }
      if (tokenData.tokenInfo) {
        clarityAsset.assetHash = tokenData.tokenInfo.value.data['asset-hash'].buffer.toString('hex')
        clarityAsset.edition = tokenData.tokenInfo.value.data.edition.value.toNumber()
        clarityAsset.seriesOriginal = tokenData.tokenInfo.value.data['series-original'].value.toNumber()
        clarityAsset.maxEditions = tokenData.tokenInfo.value.data['max-editions'].value.toNumber()
        clarityAsset.maxEditionCost = tokenData.tokenInfo.value.data['edition-cost'].value.toNumber()
        clarityAsset.date = tokenData.tokenInfo.value.data.date.value.toNumber()
      }
      if (tokenData.transferCounter) {
        clarityAsset.transferCount = tokenData.transferCounter.value.toNumber()
      }
      return clarityAsset
    } else if (method === 'get-sale-data') {
      return {
        biddingEndTime: res.value.data['bidding-end-time'].value.toNumber(),
        incrementPrice: this.fromMicroAmount(res.value.data['increment-stx'].value.toNumber()),
        reservePrice: this.fromMicroAmount(res.value.data['reserve-stx'].value.toNumber()),
        buyNowOrStartingPrice: this.fromMicroAmount(res.value.data['amount-stx'].value.toNumber()),
        saleType: res.value.data['sale-type'].value.toNumber()
      }
    } else if (method === 'get-base-token-uri') {
      return td.decode(res.buffer)
    }
  },
  resolvePrincipalsTokens: function (network, tokens) {
    const resolvedTokens = []
    tokens.forEach((token) => {
      resolvedTokens.push(this.resolvePrincipalsToken(network, token))
    })
    return resolvedTokens
  },
  resolvePrincipalsToken: function (network, token) {
    try {
      token.owner = this.convertAddress(network, token.owner)
    } catch (err) {
      // c32address fails if the address is already converted - use this to prevent
      // double conversions
      return token
    }
    token.tokenInfo.editionCost = this.fromMicroAmount(token.tokenInfo.editionCost)
    if (token.offerHistory) {
      token.offerHistory.forEach((offer) => {
        offer.offerer = this.convertAddress(network, offer.offerer)
        offer.amount = this.fromMicroAmount(offer.amount)
      })
    }
    if (token.transferHistory) {
      token.transferHistory.forEach((transfer) => {
        transfer.from = this.convertAddress(network, transfer.from)
        transfer.to = this.convertAddress(network, transfer.to)
        transfer.amount = this.fromMicroAmount(transfer.amount)
      })
    }
    if (token.saleData) {
      token.saleData.buyNowOrStartingPrice = this.fromMicroAmount(token.saleData.buyNowOrStartingPrice)
      token.saleData.incrementPrice = this.fromMicroAmount(token.saleData.incrementPrice)
      token.saleData.reservePrice = this.fromMicroAmount(token.saleData.reservePrice)
    }
    if (token.beneficiaries) {
      let idx = 0
      token.beneficiaries.shares.forEach((share) => {
        token.beneficiaries.shares[idx].value = this.fromMicroAmount(share.value) / 100
        token.beneficiaries.addresses[idx].valueHex = this.convertAddress(network, token.beneficiaries.addresses[idx].valueHex)
        idx++
      })
    }
    if (token.bidHistory && token.bidHistory.length > 0) {
      const cycledBidHistory = []
      token.bidHistory.forEach((bid) => {
        bid.amount = this.fromMicroAmount(bid.amount)
        bid.bidder = this.convertAddress(network, bid.bidder)
        if (token.saleData.saleCycleIndex === bid.saleCycle) {
          cycledBidHistory.push(bid)
        }
      })
      token.cycledBidHistory = cycledBidHistory
    }
    return token
  },
  resolvePrincipals: function (registry, network) {
    if (!registry || !registry.administrator) return
    try {
      registry.administrator = this.convertAddress(network, registry.administrator)
    } catch (err) {
      // c32address fails if the address is already converted - use this to prevent
      // double conversions
      return registry
    }
    if (registry.applications) {
      registry.applications.forEach((app) => {
        app.owner = this.convertAddress(network, app.owner)
        if (app.tokenContract) {
          app.tokenContract.administrator = this.convertAddress(network, app.tokenContract.administrator)
          app.tokenContract.mintPrice = this.fromMicroAmount(app.tokenContract.mintPrice)
        }
      })
    }
    return registry
  }
}
export default utils
