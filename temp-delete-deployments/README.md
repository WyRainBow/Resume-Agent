# delete-all-deployments

Deletes all deployments given a Pages project name

## How to

```
# Install dependencies
npm install

# Delete all deployments except for the live production deployment (excluding aliased deployments)
CF_API_TOKEN=xxx CF_ACCOUNT_ID=xxx CF_PAGES_PROJECT_NAME=xxx npm start

# Delete all deployments except for the live production deployment (INCLUDING aliased deployments, eg. my-branch.exampleproj.pages.dev)
CF_API_TOKEN=xxx CF_ACCOUNT_ID=xxx CF_PAGES_PROJECT_NAME=xxx CF_DELETE_ALIASED_DEPLOYMENTS=true npm start
```
