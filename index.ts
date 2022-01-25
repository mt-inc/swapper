import Ether from 'ethers'

class Swapper {
  private addresses: {
    factory: string
    WBNB: string
    router: string
    my: string
  }
  private mnemonic: string
  private ws: string
  private provider: Ether.providers.WebSocketProvider
  private wallet: Ether.ethers.Wallet
  private account: Ether.ethers.Wallet
  constructor() {
    this.addresses = {
      factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      my: '0x0AE4546d995D8F5747eE2aBda9795a1fd9Df2398',
    }
    this.mnemonic =
      'month pulse hurt media nominee result theme chalk fit midnight strong danger'
    this.ws =
      'wss://speedy-nodes-nyc.moralis.io/ca96454eebe7a9c40f78ae7a/bsc/mainnet/ws'
    this.provider = new Ether.providers.WebSocketProvider(this.ws)
    this.wallet = Ether.Wallet.fromMnemonic(this.mnemonic)
    this.account = this.wallet.connect(this.provider)
  }
  startMonitoring() {
    const factory = new Ether.Contract(
      this.addresses.factory,
      [
        'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
      ],
      this.account
    )
    factory.on('PairCreated', async (token0, token1, addressPair) => {
      console.log(`
        ~~~~~~~~~~~~~~~~~~
        New pair detected
        ~~~~~~~~~~~~~~~~~~
        token0: ${token0 === this.addresses.WBNB ? 'WBNB' : token0}
        token1: ${token1 === this.addresses.WBNB ? 'WBNB' : token1}
        addressPair: ${addressPair}
        `)
    })
  }
}

new Swapper().startMonitoring()
