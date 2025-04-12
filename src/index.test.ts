import request from 'supertest';
import App from './app';

const app = new App();

describe('Test Application', function () {
    test('GET /api', (done) => {
        request(app.app)
            .get('/api')
            .expect(200, {
                message: 'success',
            })
            .end((err) => {
                if (err) return done(err);
                return done();
            });
    });
});
