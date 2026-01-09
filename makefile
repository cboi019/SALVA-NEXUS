# The hyphen means "don't error if the file is missing"
-include packages/backend/.env

# This exports all variables from the .env so Forge/Cast can see them
export

.PHONY: mint burn

# 1. Mint NGNs (After confirming payment to reserve)
# Usage: make mint AMOUNT=1000 RECIPIENT=0xYourAddress
mint:
	@echo "Minting $(AMOUNT) NGNs to $(RECIPIENT)..."
	cast send $(NGN_TOKEN_ADDRESS) \
		"mint(address,uint256)" \
		$(RECIPIENT) \
		$$(cast to-wei $(AMOUNT) 6) \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) \
		--private-key $(BACKEND_PRIVATE_KEY)

# 2. Burn NGNs (After confirming withdrawal from reserve)
# Usage: make burn AMOUNT=1000 FROM=0xYourAddress
burn:
	@echo "Burning $(AMOUNT) NGNs from $(FROM)..."
	cast send $(NGN_TOKEN_ADDRESS) \
		"burn(address,uint256)" \
		$(FROM) \
		$$(cast to-wei $(AMOUNT) 6) \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) \
		--private-key $(BACKEND_PRIVATE_KEY)