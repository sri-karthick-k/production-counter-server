FROM node

ENV PG_USER counter
ENV PG_PASSWORD counter
ENV PG_HOST localhost
ENV PG_PORT 5432
ENV PG_DB counterdb
ENV AUTH_KEY "123"


WORKDIR /usr/src/server
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install
COPY . .
EXPOSE 4001
RUN chown -R node /usr/src/server
USER node
CMD ["node", "index.js"]
