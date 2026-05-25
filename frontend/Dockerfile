FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
# Use npm install (not npm ci) so new packages added to package.json
# are resolved even before the lockfile is regenerated locally.
RUN npm install

FROM node:20-alpine AS runner

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
