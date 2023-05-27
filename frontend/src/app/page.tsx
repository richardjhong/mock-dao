"use client";

import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import Web3Modal from "web3modal";
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../../constants";

const Home = () => {
  const [treasuryBalance, setTreasuryBalance] = useState<string>("0");
  const [numProposals, setNumProposals] = useState<string>("0");
  const [proposals, setProposals] = useState<any[] | []>([]);
  const [nftBalance, setNftBalance] = useState<number>(0);
  const [fakeNftTokenId, setFakeNftTokenId] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const web3ModalRef = useRef<Web3Modal | undefined>(undefined);

  /**
   * connectWallet: Helper function to connect wallet
   */
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * getDAOOwner: Gets the contract owner by connected address
   */
  const getDAOOwner = async () => {
    try {
      const signer = (await getProviderOrSigner(true)) as providers.JsonRpcSigner;
      const contract = await getDaoContractInstance(signer);

      const _owner = await contract!.owner();
      const address = await signer.getAddress();
      if (address.toLowerCase() === _owner.toLowerCase()) setIsOwner(true);
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * withdrawDAOEther: withdraws ether by calling the withdraw function in the contract
   */
  const withdrawDAOEther = async () => {
    try {
      const signer = (await getProviderOrSigner(true)) as providers.JsonRpcSigner;
      const contract = await getDaoContractInstance(signer);

      const tx = await contract!.withdrawEther();
      setLoading(true);

      await tx.wait();
      setLoading(false);
      getDAOTreasuryBalance();
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * getDAOTreasuryBalance: Reads the ETH balance of the DAO contract and sets the `treasuryBalance` state variable
   */
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner();
      const balance = await provider.getBalance(CRYPTODEVS_DAO_CONTRACT_ADDRESS);
      setTreasuryBalance(balance.toString());
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * getNumProposalsInDAO: Reads the number of proposals in the DAO contract and sets the `numProposals` state variable
   */
  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner();
      const contract = await getDaoContractInstance(provider);
      const daoNumProposals = await contract!.numProposals();
      setNumProposals(daoNumProposals.toString());
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * getUserNFTBalance: Reads the balance of the user's CryptoDEvs NFTs and sets the `nftBalance` state variable
   */
  const getUserNFTBalance = async () => {
    try {
      const signer = (await getProviderOrSigner(true)) as providers.JsonRpcSigner;
      const nftContract = await getCryptodevsNFTContractInstance(signer);
      console.log("nftContract: ", nftContract);
      const balance = await nftContract!.balanceOf(signer.getAddress());
      console.log("balance: ", balance);
      setNftBalance(parseInt(balance.toString()));
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * createProposal: Calls the `createProposal` function in the contract, using the tokenId from `fakeNftTokenId`
   */
  const createProposal = async () => {
    try {
      const signer = (await getProviderOrSigner(true)) as providers.JsonRpcSigner;
      const daoContract = await getDaoContractInstance(signer);
      const txn = await daoContract!.createProposal(fakeNftTokenId);
      setLoading(true);

      await txn.wait();
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * fetchProposalById: Helper function to fetch and parse one proposal from the DAO Contract given the proposal ID
   *                     and converts the returned data into a JavaScript object with usable values
   */
  const fetchProposalById = async (id: number) => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = await getDaoContractInstance(provider);
      const proposal = await daoContract!.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nfTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed,
      };

      return parsedProposal;
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * fetchAllProposals: Runs a loop `numProposals` times to fetch all proposals in the DAO and sets the `proposals`
   *                    state variable
   */
  const fetchAllProposals = async () => {
    try {
      const proposals = [];
      for (let i = 0; i < parseInt(numProposals); i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * voteOnProposal: Calls the `voteOnProposal` function in the contract, using the passed proposal Id and vote
   */
  const voteOnProposal = async (proposalId: number, _vote: string) => {
    try {
      const signer = (await getProviderOrSigner(true)) as providers.JsonRpcSigner;
      const daoContract = await getDaoContractInstance(signer);

      let vote = _vote === "YAY" ? 0 : 1;
      const txn = await daoContract!.voteOnProposal(proposalId, vote);
      setLoading(true);

      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * executeProposal: Calls the `executeProposal` function in the contract, using the passed proposal ID
   */
  const executeProposal = async (proposalId: number) => {
    try {
      const signer = (await getProviderOrSigner(true)) as providers.JsonRpcSigner;
      const daoContract = await getDaoContractInstance(signer);
      const txn = await daoContract!.executeProposal(proposalId);
      setLoading(true);

      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
      getDAOTreasuryBalance();
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * getProviderOrSigner: Helper function to fetch a Provider/Signer instance from Metamask
   */

  const getProviderOrSigner = async (needSigner = false) => {
    if (!web3ModalRef.current) {
      throw new Error("web3ModalRef.current is undefined");
    }

    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 11155111) {
      window.alert("Please switch to the Sepolia network!");
      throw new Error("Please switch to the Sepolia network");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  /**
   * getDaoContractInstance: Helper function to return a DAO Contract instance given a provider/signer
   */
  const getDaoContractInstance = async (
    providerOrSigner: providers.JsonRpcSigner | providers.Web3Provider
  ) => {
    try {
      return new Contract(CRYPTODEVS_DAO_CONTRACT_ADDRESS, CRYPTODEVS_DAO_ABI, providerOrSigner);
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * getCryptodevsNFTContractInstance: Helper function to return a CryptoDevs NFT Contract instance given a
   *                                   provider/signer
   */
  const getCryptodevsNFTContractInstance = async (
    providerOrSigner: providers.JsonRpcSigner | providers.Web3Provider
  ) => {
    try {
      return new Contract(CRYPTODEVS_NFT_CONTRACT_ADDRESS, CRYPTODEVS_NFT_ABI, providerOrSigner);
    } catch (err) {
      console.error(err);
    }
  };

  // Prompts user to connect wallet if not connected and then calls helper functions
  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "sepolia",
        providerOptions: {},
        disableInjectedProvider: false,
      });

      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();
        getDAOOwner();
      });
    }
  }, [walletConnected]);

  // Used to re-fetch all proposals in the DAO when user swtiches to 'View Proposals' tab
  useEffect(() => {
    if (selectedTab === "View Proposals") fetchAllProposals();
  }, [selectedTab]);

  // Renders the contents of the appropriate tab based on `selectedTab`
  const renderTabs = () => {
    switch (selectedTab) {
      case "Create Proposal":
        return renderCreateProposalTab();
      case "View Proposals":
        return renderViewProposalsTab();
      default:
        return null;
    }
  };

  // Renders the 'Create Proposal' tab content
  const renderCreateProposalTab = () => {
    if (loading) {
      return <div className="text-lg">Loading... Waiting for transaction...</div>;
      // } else if (nftBalance === 0) {
      //   return (
      //     <div className="text-lg">
      //       You do not own any CryptoDevs NFTs. <br />
      //       <b>You cannot create or vote on proposals</b>
      //     </div>
      //   );
    } else {
      return (
        <div className="mt-8">
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNftTokenId(e.target.value)}
          />
          <button
            onClick={createProposal}
            className="rounded-md bg-indigo-500 border-none text-white text-base px-4 py-2 cursor-pointer mr-2 mt-4"
          >
            Create
          </button>
        </div>
      );
    }
  };

  // Renders the 'View Proposals' tab content
  const renderViewProposalsTab = () => {
    if (loading) {
      return <div className="text-lg">Loading... Waiting for transaction...</div>;
    } else if (proposals.length === 0) {
      return <div className="text-lg">No proposals have been created</div>;
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div
              key={index}
              className="px-2 mt-1 border-2 border-black flex flex-col"
            >
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className="flex flex-1 justify-between">
                  <button
                    className="rounded-md bg-indigo-500 border-none text-white text-base px-4 py-2 cursor-pointer mr-2 mt-4"
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                  <button
                    className="rounded-md bg-indigo-500 border-none text-white text-base px-4 py-2 cursor-pointer mr-2 mt-4"
                    onClick={() => voteOnProposal(p.proposalId, "NAY")}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className="flex flex-1 justify-between">
                  <button
                    className="rounded-md bg-indigo-500 border-none text-white text-base px-4 py-2 cursor-pointer mr-2 mt-4"
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div>
      <Head>
        <title>Crypto Devs</title>
        <link
          rel="icon"
          href="/favicon.ico"
        />
      </Head>
      <div className="min-h-screen flex flex-row justify-center items-center font-mono">
        <div className="mx-8">
          <h1 className="text-4xl mb-2">Welcome to Crypto Devs!</h1>
          <div className="text-lg">Welcome to the DAO!</div>
          <div className="text-lg">
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div>
          <div className="flex flex-1 justify-betwen">
            <button
              className="rounded bg-blue-700 border-none text-white text-base p-5 w-52 cursor-pointer mb-2 md:w-full md:flex md:flex-col md:justify-center md:items-center mr-3"
              onClick={() => setSelectedTab("Create Proposal")}
            >
              Create Proposal
            </button>
            <button
              className="rounded bg-blue-700 border-none text-white text-base p-5 w-52 cursor-pointer mb-2 md:w-full md:flex md:flex-col md:justify-center md:items-center"
              onClick={() => setSelectedTab("View Proposals")}
            >
              View Proposals
            </button>
          </div>
          {renderTabs()}
          {/* Display additional withdraw button if connected wallet is contract owner */}
          {isOwner ? (
            <div>
              {loading ? (
                <button className="rounded bg-blue-700 border-none text-white text-base p-5 w-52 cursor-pointer mb-2 md:w-full md:flex md:flex-col md:justify-center md:items-center">
                  Loading...
                </button>
              ) : (
                <button
                  className="rounded bg-blue-700 border-none text-white text-base p-5 w-52 cursor-pointer mb-2 md:w-full md:flex md:flex-col md:justify-center md:items-center"
                  onClick={withdrawDAOEther}
                >
                  Withdraw DAO Eth
                </button>
              )}
            </div>
          ) : (
            ""
          )}
        </div>
        <div>
          <img
            className="w-70 h-50 ml-20"
            src="/cryptodevs/0.svg"
          />
        </div>
      </div>
      <footer className="flex justify-center items-center py-8 border-t-2 border-gray-300">
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
};

export default Home;
