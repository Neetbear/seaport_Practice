const { Seaport } = require("@opensea/seaport-js");
const { ItemType } = require("@opensea/seaport-js/lib/constants");
const { generateRandomSalt } = require("@opensea/seaport-js/lib/utils/order");
const { isCurrencyItem } = require("@opensea/seaport-js/lib/utils/item");
const { ethers, BigNumber } = require("ethers");
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

// db 필요 부분 총 3개 예상 
// 1. createOrder 후 order fulfillOrder 전까지 order 정보 
// 2. 거래가에 대한 영역 및 list 관련
// 3. 수수료나 창작자의 2차 거래 수익등 관련 
// 입력받을 값 마감 시간, offer 정보, consideration 정보 (수수료 현재까진 미사용 예정)
const offerOrder = async () => {
    const fulfiller = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1 
    const offerer = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104";   // seaport2

    const orderCreate = await seaport2.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            // zone 사용시에만 입력 
            zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
            zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            // startTime: Date.now(), 생략하면 알아서 blocktime 들어가니 왠만하면 생략할 것 
            endTime:1664428149, // 현재시간부터 마감시간까지 timestamp 계산해서 넣기
            offer: [{ // offer 정보 item type, address, id, amount(, endamount 생략가능)
                itemType: ItemType.ERC721,
                token: "0x51Bae864d00D543F2A40f2B6A623ABBea46AeA7e",
                identifier: "1",
                amount: "1",
                endAmount: "1"
            }],
            consideration: [{ // offer 정보 item type(ether 시 생략가능), address, id, amount(, endamount 생략가능), recipient 수령인
                token: "0x0000000000000000000000000000000000000000",
                amount: ethers.utils.parseEther("0.01").toString(),
                endAmount: ethers.utils.parseEther("0.01").toString(),
                identifier: "0",
                recipient: offerer
            }],
            // counter: 0, seaport가 알아서 찾아주니 생략해도 된다
            allowPartialFills: false, // 부분거래 허용시에만 true
            restrictedByZone: true, // zone 사용시에만 true 줄 수 있다
            fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        offerer
    );

    const order = await orderCreate.executeAllActions(); // 구조상 db에 저장 해야된다
    console.log("create order : ", order);

    // 거래 취소
    // 취소된 거래 fulfill 시도시 Warning! Error encountered during contract execution [execution reverted]로 취소된다 
    //      -> etherscan으로 확인 가능
    // const orderCancel = await seaport2.cancelOrders([order.parameters], offerer).transact();
    // console.log("cancel order : ", orderCancel);

    // const orderhash = seaport2.getOrderHash(order.parameters);
    // console.log("order hash : ", orderhash);

    // const orderStatus = await seaport2.getOrderStatus(orderhash);
    // console.log("order status : ", orderStatus);

    // const counterNum = await seaport2.getCounter(offerer);
    // console.log("counter : ", counterNum);

    const { executeAllActions: executeAllFulfillActions } = await seaport1.fulfillOrder({
        order, // 구조상 db에서 찾아와야 할 것으로 보인다 opensea-js getOrder 참조 
        accountAddress: fulfiller,
        conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
        // 수령인이 달라질 경우 recipientAddress argument 넣어줄 것
    });

    const transaction = await executeAllFulfillActions();
    console.log("offer order : ", transaction);
} 
// offerOrder();

// bulkOrder 는 offerer가 만든 모든 order 취소 사용할일 없어보인다
const bulkOrder = async () => {
    const fulfiller = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1
    const offerer = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104";   // seaport2

    const bulkorders2 = await seaport2.bulkCancelOrders(
        offerer
    ).transact();

    console.log("bulk order : ", bulkorders2);

    const bulkorders1 = await seaport1.bulkCancelOrders(
        fulfiller
    ).transact();

    console.log("bulk order : ", bulkorders1);
} 
// bulkOrder();

// 1155 경우
const offer1155 = async () =>{
    const offerer = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1
    const fulfiller = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104"; // seaport2

    const orderCreate = await seaport1.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
            zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            // startTime:Date.now(),
            endTime:1664428149,
            offer: [{
                itemType: ItemType.ERC1155,
                token: "0x001ebb9bD304777cEa755e6CBcc7438F5bF7d91e",
                identifier: "0",
                amount: "2",
                endAmount: "2"
            }],
            consideration: [{
                token: "0x0000000000000000000000000000000000000000",
                amount: ethers.utils.parseEther("0.01").toString(),
                identifier: "0",
                recipient: offerer
            }],
            // counter: 0,
            allowPartialFills: false,
            restrictedByZone: true,
            fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        offerer
    );

    const order = await orderCreate.executeAllActions();
    console.log("create order : ", order);

    // const orderCancel = await seaport1.cancelOrders([order.parameters], offerer).transact();
    // console.log("cancel order : ", orderCancel);

    const orderhash = seaport1.getOrderHash(order.parameters);
    console.log("order hash : ", orderhash);

    const orderStatus = await seaport1.getOrderStatus(orderhash);
    console.log("order status : ", orderStatus);

    const counterNum = await seaport1.getCounter(offerer);
    console.log("counter : ", counterNum);

    const { executeAllActions: executeAllFulfillActions } =
    await seaport2.fulfillOrder({
        order,
        accountAddress: fulfiller.address,
        conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
    });

    const transaction = await executeAllFulfillActions();
    console.log("offer order : ", transaction);
} 
// offer1155();

// specific buyer 경우, 즉 matchOrders
// matchorder 사용 -> 어느 offer랑 어느 consideration을 매칭해줘야 하나의 기능이 필요한 order
const offerOrderSpecificBuyer = async () => {
    const fulfiller = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1 
    const offerer = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104";   // seaport2

    const orderCreate = await seaport2.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            // zone 사용시에만 입력 
            zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
            zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            // startTime: Date.now(), 생략하면 알아서 blocktime 들어가니 왠만하면 생략할 것 
            endTime:1664428149, // 현재시간부터 마감시간까지 timestamp 계산해서 넣기
            offer: [{ // offer 정보 item type, address, id, amount(, endamount 생략가능)
                itemType: ItemType.ERC721,
                token: "0x51Bae864d00D543F2A40f2B6A623ABBea46AeA7e",
                identifier: "0",
                amount: "1",
                endAmount: "1"
            }],
            consideration: [{ // offer 정보 item type(ether 시 생략가능), address, id, amount(, endamount 생략가능), recipient 수령인
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
                recipient: fulfiller // 구매 대상자
            }],
            // counter: 0, seaport가 알아서 찾아주니 생략해도 된다
            allowPartialFills: false, // 부분거래 허용시에만 true
            restrictedByZone: true, // zone 사용시에만 true 줄 수 있다
            fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        offerer
    );

    const order = await orderCreate.executeAllActions(); // 구조상 db에 저장 해야된다
    console.log("order: ", order);
    
    const paymentItems = order.parameters.consideration.filter(
        (item) => item.recipient.toLowerCase() !== fulfiller.toLowerCase()
    );

    const counterOrder = constructPrivateListingCounterOrder(
        order,
        fulfiller
    );
    console.log("counterOrder: ", counterOrder);

    const fulfillments = getPrivateListingFulfillments(order);
    console.log("fulfillments : ", fulfillments);

    // fulfillOrder 말고 matchOrder 함수 부르는 경우를 위한 기능 추가 필요 
    // -> order의 offer item이 consideration item에 포함된 경우
    const transaction = await seaport1.matchOrders({
        orders: [order, counterOrder], 
        fulfillments,
        overrides: {
            value: counterOrder.parameters.offer[0].startAmount,
        },
        accountAddress: fulfiller,
    }).transact();
    console.log("match order : ", transaction);
} 
// offerOrderSpecificBuyer();

// bundle order -> 즉 offer가 2개 이상 그대로 fulfillOrder 사용하면 된다
const offerOrders = async () => {
    const fulfiller = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1 
    const offerer = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104";   // seaport2

    const orderCreate = await seaport2.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
            zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            endTime:1664428149,
            offer: [{
                itemType: ItemType.ERC721,
                token: "0x7995EcBDAfA4703A7BD2E3d1e19CcfC71a4A8457",
                identifier: "0",
                amount: "1",
                endAmount: "1"
            }, {
                itemType: ItemType.ERC721,
                token: "0x7995EcBDAfA4703A7BD2E3d1e19CcfC71a4A8457",
                identifier: "1",
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
            allowPartialFills: false,
            restrictedByZone: true,
            fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        offerer
    );

    const order = await orderCreate.executeAllActions();
    console.log("create order : ", order);

    // const orderCancel = await seaport2.cancelOrders([order.parameters], offerer).transact();
    // console.log("cancel order : ", orderCancel);

    const { executeAllActions: executeAllFulfillActions } = await seaport1.fulfillOrder({
        order, 
        accountAddress: fulfiller,
        conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
    });

    const transaction = await executeAllFulfillActions();
    console.log("offer order : ", transaction);
} 
// offerOrders();

// 구매 제안 order의 경우
const buyOrder = async () => {
    const fulfiller = "0x55C5aEaB5D6676aeEA374A48246393a63eaab7aE"; // seaport1 
    const offerer = "0x191a0b6268C7aeaaE8C2e35Ff01199875ef49104";   // seaport2

    const orderCreate = await seaport2.createOrder(
        {
            conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
            zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
            zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            endTime:1664428149,
            offer: [{ // (주의) seaport는 offer에 ether 불가로 설계되어 있다 -> ether는 erc20 규격이 아니라서
                token: "0xc778417E063141139Fce010982780140Aa0cD5Ab", // WETH address
                amount: ethers.utils.parseEther("0.01").toString(),
                endAmount: ethers.utils.parseEther("0.01").toString(),
                identifier: "0"
            }],
            consideration: [{
                itemType: ItemType.ERC721,
                token: "0x7995EcBDAfA4703A7BD2E3d1e19CcfC71a4A8457",
                identifier: "1",
                amount: "1",
                endAmount: "1"
            }],
            allowPartialFills: false,
            restrictedByZone: true,
            fees:[{recipient: "0x0000a26b00c1F0DF003000390027140000fAa719", basisPoints: 250}],
        },
        offerer
    );

    const order = await orderCreate.executeAllActions();
    console.log("create order : ", order);

    console.log("order Type : ", order.parameters.orderType); 

    // const orderCancel = await seaport2.cancelOrders([order.parameters], offerer).transact();
    // console.log("cancel order : ", orderCancel);

    const { executeAllActions: executeAllFulfillActions } = await seaport1.fulfillOrder({
        order, 
        accountAddress: fulfiller,
        conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
    });

    const transaction = await executeAllFulfillActions();
    console.log("offer order : ", transaction);
} 
buyOrder();


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
const isMatchOrder = (
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