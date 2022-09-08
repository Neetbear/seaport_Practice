# Practice for Seaport-js
## .env
```
ALCHEMY_KEY = "ISVNLYW6KZAkPqMj2U-UPNGswrjD2CoB"    // your alchemy key
GOERLI_KEY = "n2cukugoY49cwzU6y6tvgrIxgTz36xb2"     // your alchemy key
ACCOUNT_PRIVATE_KEY1 = "your metamask address privatekey1"
ACCOUNT_PRIVATE_KEY2 = "your metamask address privatekey2"
```

## Before start 
```
npm install
```
Before start make your nft using remix or hardhat.
After making nft, plz fix item contract address, types, ids in the code.
(sample.js just test functions you don't need to touch)

## create order arguments
item type 
    0 : ether (생략 가능하다) -> 이더의 경우 address, tokenid(identifier) 생략가능하다
    1 : erc20
    2 : erc721
    3 : erc1155
### 일반 order
``` javascript
const orderCreate = await seaport.createOrder(
    {
        endTime:1664428149,
        offer: [{ // 제공 item
            itemType: ItemType.ERC721, // 2
            token: "0x51Bae864d00D543F2A40f2B6A623ABBea46AeA7e", 
            identifier: "0",
            amount: "1",
            endAmount: "1"
        }],
        consideration: [{
            token: "0x0000000000000000000000000000000000000000",
            amount: ethers.utils.parseEther("0.01").toString(),  
            endAmount: ethers.utils.parseEther("0.01").toString(),
            identifier: "0",
            recipient: offerer
        }],
    },
    offerer // 연결된 지갑 address 자동으로 들어가므로 생략가능
)
const order = await orderCreate.executeAllActions(); // order를 db에 저장 해야된다
console.log("create order : ", order);
```
```javascript
const { executeAllActions: executeAllFulfillActions } = await seaport1.fulfillOrder({ 
    order, // 구조상 db에서 찾아와야 할 것으로 보인다 opensea-js getOrder 참조 
    accountAddress: fulfiller,
    conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
    // 수령인이 달라질 경우 recipientAddress argument 넣어줄 것
});

const transaction = await executeAllFulfillActions();
console.log("offer order : ", transaction);
```

### 특정 구매자
``` javascript
const orderCreate = await seaport.createOrder(
    {
        endTime:1664428149,
        offer: [{ // 제공 item
            itemType: ItemType.ERC721, // 2
            token: "0x51Bae864d00D543F2A40f2B6A623ABBea46AeA7e", 
            identifier: "0",
            amount: "1",
            endAmount: "1"
        }],
        consideration: [{
            token: "0x0000000000000000000000000000000000000000",
            amount: ethers.utils.parseEther("0.01").toString(),
            endAmount: ethers.utils.parseEther("0.01").toString(),
            identifier: "0",
            recipient: offerer
        }, { 
            itemType: ItemType.ERC721,
            token: "0x51Bae864d00D543F2A40f2B6A623ABBea46AeA7e",
            identifier: "0",
            amount: "1",
            endAmount: "1",
            recipient: fulfiller // 구매 대상자를 위해 consideration 작성 필수
        }],
    },
    offerer // 연결된 지갑 address 자동으로 들어가므로 생략가능
)
```
```javascript
const orderCreate = await seaport.matchOrders({
    orders: [order, counterOrder], 
    fulfillments,
    overrides: {
        value: counterOrder.parameters.offer[0].startAmount,
    },
    accountAddress: fulfiller,
}).transact();
console.log("match order : ", transaction);
```

#### matchOrder 필요 기타 함수
```javascript
const constructPrivateListingCounterOrder = (
    order,
    privateSaleRecipient
  ) => {
    // Counter order offers up all the items in the private listing consideration
    // besides the items that are going to the private listing recipient
    const paymentItems = order.parameters.consideration.filter(
      (item) =>
        item.recipient.toLowerCase() !== privateSaleRecipient.toLowerCase()
    );
  
    if (!paymentItems.every((item) => isCurrencyItem(item))) {
      throw new Error(
        "The consideration for the private listing did not contain only currency items"
      );
    }
    if (
      !paymentItems.every((item) => item.itemType === paymentItems[0].itemType)
    ) {
      throw new Error("Not all currency items were the same for private order");
    }
  
    const { aggregatedStartAmount, aggregatedEndAmount } = paymentItems.reduce(
      ({ aggregatedStartAmount, aggregatedEndAmount }, item) => ({
        aggregatedStartAmount: aggregatedStartAmount.add(item.startAmount),
        aggregatedEndAmount: aggregatedEndAmount.add(item.endAmount),
      }),
      {
        aggregatedStartAmount: BigNumber.from(0),
        aggregatedEndAmount: BigNumber.from(0),
      }
    );
  
    const counterOrder = {
      parameters: {
        ...order.parameters,
        offerer: privateSaleRecipient,
        offer: [
          {
            itemType: paymentItems[0].itemType,
            token: paymentItems[0].token,
            identifierOrCriteria: paymentItems[0].identifierOrCriteria,
            startAmount: aggregatedStartAmount.toString(),
            endAmount: aggregatedEndAmount.toString(),
          },
        ],
        // The consideration here is empty as the original private listing order supplies
        // the taker address to receive the desired items.
        consideration: [],
        salt: generateRandomSalt(),
        totalOriginalConsiderationItems: 0,
      },
      signature: "0x",
    };
  
    return counterOrder;
};

// fulfillments 생성
const getPrivateListingFulfillments = (
    privateListingOrder
) => {
    const nftRelatedFulfillments = [];
  
    // For the original order, we need to match everything offered with every consideration item
    // on the original order that's set to go to the private listing recipient
    privateListingOrder.parameters.offer.forEach((offerItem, offerIndex) => {
        const considerationIndex = privateListingOrder.parameters.consideration.findIndex(
            (considerationItem) =>
                considerationItem.itemType === offerItem.itemType &&
                considerationItem.token === offerItem.token &&
                considerationItem.identifierOrCriteria === offerItem.identifierOrCriteria
        );
        if (considerationIndex === -1) {
            throw new Error(
                "Could not find matching offer item in the consideration for private listing"
            );
        }
        nftRelatedFulfillments.push({
            offerComponents: [{
                orderIndex: 0,
                itemIndex: offerIndex,
            }],
            considerationComponents: [{
                orderIndex: 0,
                itemIndex: considerationIndex,
            }],
        });
    });
  
    const currencyRelatedFulfillments = [];
  
    // For the original order, we need to match everything offered with every consideration item
    // on the original order that's set to go to the private listing recipient
    privateListingOrder.parameters.consideration.forEach(
        (considerationItem, considerationIndex) => {
            if (!isCurrencyItem(considerationItem)) {
                return;
            }
            // We always match the offer item (index 0) of the counter order (index 1)
            // with all of the payment items on the private listing
            currencyRelatedFulfillments.push({
                offerComponents: [{
                        orderIndex: 1,
                        itemIndex: 0,
                }],
                considerationComponents: [{
                        orderIndex: 0,
                        itemIndex: considerationIndex,
                }],
            });
        }
    );
  
    return [...nftRelatedFulfillments, ...currencyRelatedFulfillments];
};
```

### cancel order
```javascript
const orderCancel = await seaport.cancelOrders([order.parameters], offerer).transact();
console.log("cancel order : ", orderCancel);
```