import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSecretFrame = await deploy("SecretFrame", {
    from: deployer,
    log: true,
  });

  console.log(`SecretFrame contract: ${deployedSecretFrame.address}`);
};
export default func;
func.id = "deploy_secretFrame"; // id required to prevent reexecution
func.tags = ["SecretFrame"];
