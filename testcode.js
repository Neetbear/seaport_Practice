const { Seaport } = require("@opensea/seaport-js");
const { ItemType } = require("@opensea/seaport-js/lib/constants");
const { generateRandomSalt } = require("@opensea/seaport-js/lib/utils/order");
const { isCurrencyItem } = require("@opensea/seaport-js/lib/utils/item");
const { ethers, BigNumber } = require("ethers");
const { addressUtils } = require("@0x/utils");
require('dotenv').config();

const { ALCHEMY_KEY, ACCOUNT_PRIVATE_KEY1, ACCOUNT_PRIVATE_KEY2 } = process.env;

// Provider must be provided to the signer when supplying a custom signer
const provider = new ethers.providers.JsonRpcProvider(
    `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_KEY}`
);  // https://rinkeby.infura.io/v3/68d856374aea4c2f8c170cb9e8b27a67 infura 사용시 

// 사용자별 지갑 연결이 다르니까 실제 구현시 2개 필요 없음
const signer1 = new ethers.Wallet(ACCOUNT_PRIVATE_KEY1, provider); // 0x55C
const signer2 = new ethers.Wallet(ACCOUNT_PRIVATE_KEY2, provider); // 0x191

const seaport1 = new Seaport(signer1);
const seaport2 = new Seaport(signer2);
// console.log(seaport1); -> seaport 함수들 궁금할 시

const createOrder = async (
    ACCOUNT_PRIVATE_KEY, endTime, offers, considerations, fees
) => {
    const signer = new ethers.Wallet(ACCOUNT_PRIVATE_KEY, provider); // 0x191
    const seaport = new Seaport(signer);

    const orderCreate = await seaport.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
            zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            endTime: endTime,
            offer: offers,
            consideration: considerations,
            allowPartialFills: false,
            restrictedByZone: true, 
            fees:fees,
        }
    );

    const order = await orderCreate.executeAllActions();
    console.log("create order : ", order);
}
// createOrder();

const cancellOrder = async (
    ACCOUNT_PRIVATE_KEY, order
) => {
    const signer = new ethers.Wallet(ACCOUNT_PRIVATE_KEY, provider); // 0x191
    const seaport = new Seaport(signer);

    // 거래 취소
    // 취소된 거래 fulfill 시도시 Warning! Error encountered during contract execution [execution reverted]로 취소된다 
    //      -> etherscan으로 확인 가능
    const orderCancel = await seaport.cancelOrders([order.parameters]).transact();
    console.log("cancel order : ", orderCancel);
}
// cancellOrder();


const fulfill = (
    ACCOUNT_PRIVATE_KEY, order, fulfiller, recipient = "0x00"
) => {
    const signer = new ethers.Wallet(ACCOUNT_PRIVATE_KEY, provider); // 0x191
    const seaport = new Seaport(signer);

    const isMatchOrder = checkMatchOrder(order);
    if(isMatchOrder) {
        const counterOrder = constructPrivateListingCounterOrder(
            order,
            fulfiller
        );
        console.log("counterOrder: ", counterOrder);
    
        const fulfillments = getPrivateListingFulfillments(order);
        console.log("fulfillments : ", fulfillments);
        
        if(recipient == "0x00") {
            const transaction = await seaport.matchOrders({
                orders: [order, counterOrder], 
                fulfillments,
                overrides: {
                    value: counterOrder.parameters.offer[0].startAmount,
                },
                accountAddress: fulfiller
            }).transact();
        } else {
            const transaction = await seaport.matchOrders({
                orders: [order, counterOrder], 
                fulfillments,
                overrides: {
                    value: counterOrder.parameters.offer[0].startAmount,
                },
                accountAddress: fulfiller,
                recipient: recipient
            }).transact();
        }
        console.log("match order : ", transaction);
    } else {
        const { executeAllActions: executeAllFulfillActions } = await seaport1.fulfillOrder({
            order, // 구조상 db에서 찾아와야 할 것으로 보인다 opensea-js getOrder 참조 
            accountAddress: fulfiller,
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
            // 수령인이 달라질 경우 recipientAddress argument 넣어줄 것
        });

        const transaction = await executeAllFulfillActions();
        console.log("offer order : ", transaction);
    }
}
// fulfill();
    


// <이 아래는 기능들 안에서 사용되는 internal 느낌의 함수들>
// counterOrder 생성
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

// match Order 사용해야하나 판별용
const checkMatchOrder = (
    order
) => {
    order.parameters.offer.forEach((offerItem) => {
        const considerationIndex = order.parameters.consideration.findIndex(
            (considerationItem) =>
                considerationItem.itemType === offerItem.itemType &&
                considerationItem.token === offerItem.token &&
                considerationItem.identifierOrCriteria === offerItem.identifierOrCriteria
        );
        if (considerationIndex === -1) {
            return true;
        }

        return false;
    })
}