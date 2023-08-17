
for i in jq curl; do
  if ! command -V ${i} 2>/dev/null; then
    echo "${i} is not installed"
    exit 1
  fi
done

FAUCET=http://localhost:9123/gas

# pass gas to accounts matching ADMIN_ADDRESS, USER1_ADDRESS, USER2_ADDRESS, USER3_ADDRESS
if [ "${ADMIN_ADDRESS}" != "" ]; then
  echo "\nFaucet request for ADMIN_ADDRESS:"
  curl --location --request POST ${FAUCET} --header 'Content-Type: application/json' --data-raw '{
    "FixedAmountRequest": {
        "recipient": "'${ADMIN_ADDRESS}'"
    }
}'
fi

if [ "${USER1_ADDRESS}" != "" ]; then
echo "\nFaucet request for USER1_ADDRESS:"
curl --location --request POST ${FAUCET} --header 'Content-Type: application/json' --data-raw '{
    "FixedAmountRequest": {
        "recipient": "'${USER1_ADDRESS}'"
    }
}'
fi

if [ "${USER2_ADDRESS}" != "" ]; then
echo "\nFaucet request for USER2_ADDRESS:"
curl --location --request POST ${FAUCET} --header 'Content-Type: application/json' --data-raw '{
    "FixedAmountRequest": {
        "recipient": "'${USER2_ADDRESS}'"
    }
}'
fi

if [ "${USER3_ADDRESS}" != "" ]; then
echo "Faucet request for USER3_ADDRESS:"
curl --location --request POST ${FAUCET} --header 'Content-Type: application/json' --data-raw '{
    "FixedAmountRequest": {
        "recipient": "'${USER3_ADDRESS}'"
    }
}'
fi
