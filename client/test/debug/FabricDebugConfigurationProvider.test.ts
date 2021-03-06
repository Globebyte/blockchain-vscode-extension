/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

import * as vscode from 'vscode';

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FabricDebugConfigurationProvider } from '../../src/debug/FabricDebugConfigurationProvider';
import { FabricRuntime } from '../../src/fabric/FabricRuntime';
import { FabricRuntimeManager } from '../../src/fabric/FabricRuntimeManager';
import { VSCodeOutputAdapter } from '../../src/logging/VSCodeOutputAdapter';

const should: Chai.Should = chai.should();
chai.use(sinonChai);

// tslint:disable no-unused-expression
describe('FabricDebugConfigurationProvider', () => {

    describe('resolveDebugConfiguration', () => {

        let mySandbox: sinon.SinonSandbox;
        let fabricDebugConfig: FabricDebugConfigurationProvider;
        let workspaceFolder: any;
        let debugConfig: any;
        let runtimeStub: sinon.SinonStubbedInstance<FabricRuntime>;
        let findFilesStub: sinon.SinonStub;

        beforeEach(() => {
            mySandbox = sinon.createSandbox();
            fabricDebugConfig = new FabricDebugConfigurationProvider();

            runtimeStub = sinon.createStubInstance(FabricRuntime);
            runtimeStub.getName.returns('localfabric');
            runtimeStub.getConnectionProfile.resolves({ peers: [{ name: 'peer1' }] });
            runtimeStub.getChaincodeAddress.resolves('127.0.0.1:54321');
            runtimeStub.isRunning.resolves(true);
            runtimeStub.isDevelopmentMode.returns(true);

            mySandbox.stub(FabricRuntimeManager.instance(), 'get').returns(runtimeStub);

            workspaceFolder = {
                name: 'myFolder',
                uri: vscode.Uri.file('myPath')
            };

            debugConfig = {
                type: 'fabric:node',
                name: 'Launch Program'
            };

            debugConfig.request = 'myLaunch';
            debugConfig.program = 'myProgram';
            debugConfig.cwd = 'myCwd';
            debugConfig.env = { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' };
            debugConfig.args = ['start', '--peer.address', 'localhost:12345'];

            findFilesStub = mySandbox.stub(vscode.workspace, 'findFiles').resolves([]);
        });

        afterEach(() => {
            mySandbox.restore();
        });

        it('should create a debug configuration', async () => {

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345']
            });
        });

        it('should add start arg if not in there', async () => {

            debugConfig.args = ['--peer.address', 'localhost:12345'];

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['--peer.address', 'localhost:12345', 'start']
            });
        });

        it('should set program if not set', async () => {

            debugConfig.program = null;

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: path.join(path.sep, 'myPath', 'node_modules', '.bin', 'fabric-chaincode-node'),
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345']
            });
        });

        it('should add cwd if not set', async () => {

            debugConfig.cwd = null;

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: path.sep + 'myPath',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345']
            });
        });

        it('should add in env properties if not defined', async () => {
            debugConfig.env = null;

            const fakePackage: object = {
                name: 'mySmartContract',
                version: '0.0.2'
            };

            mySandbox.stub(fs, 'readFile').resolves(JSON.stringify(fakePackage));

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'mySmartContract:0.0.2' },
                args: ['start', '--peer.address', 'localhost:12345']
            });
        });

        it('should add CORE_CHAINCODE_ID_NAME to an existing env', async () => {
            debugConfig.env = { myProperty: 'myValue' };

            const fakePackage: object = {
                name: 'mySmartContract',
                version: '0.0.2'
            };

            mySandbox.stub(fs, 'readFile').resolves(JSON.stringify(fakePackage));

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'mySmartContract:0.0.2', myProperty: 'myValue' },
                args: ['start', '--peer.address', 'localhost:12345']
            });
        });

        it('should add args if not defined', async () => {
            debugConfig.args = null;

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', '127.0.0.1:54321']
            });
        });

        it('should add more args if some args exist', async () => {
            debugConfig.args = ['--myArgs', 'myValue'];

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['--myArgs', 'myValue', 'start',  '--peer.address', '127.0.0.1:54321']
            });
        });

        it('should add in request if not defined', async () => {
            debugConfig.request = null;

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);
            config.should.deep.equal({
                type: 'node2',
                request: 'launch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345']
            });
        });

        it('should give an error if runtime isnt running', async () => {
            runtimeStub.isRunning.returns(false);

            const errorSpy: sinon.SinonSpy = mySandbox.spy(VSCodeOutputAdapter.instance(), 'error');
            const otherErrorSpy: sinon.SinonSpy = mySandbox.spy(vscode.window, 'showErrorMessage');

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);

            should.not.exist(config);

            errorSpy.should.have.been.calledWith('Please ensure "local_fabric" is running before trying to debug a smart contract');
            otherErrorSpy.should.have.been.calledWith('Please ensure "local_fabric" is running before trying to debug a smart contract');
        });

        it('should give an error if runtime isn\'t in development mode', async () => {
            runtimeStub.isDevelopmentMode.returns(false);

            const errorSpy: sinon.SinonSpy = mySandbox.spy(VSCodeOutputAdapter.instance(), 'error');
            const otherErrorSpy: sinon.SinonSpy = mySandbox.spy(vscode.window, 'showErrorMessage');

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);

            should.not.exist(config);

            errorSpy.should.have.been.calledWith('Please ensure "local_fabric" is in development mode before trying to debug a smart contract');
            otherErrorSpy.should.have.been.calledWith('Please ensure "local_fabric" is in development mode before trying to debug a smart contract');

        });

        it('should debug typescript', async () => {
            findFilesStub.resolves([vscode.Uri.file('chaincode.ts')]);

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);

            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345'],
                outFiles: [path.join(workspaceFolder.uri.fsPath, '**/*.js')]
            });
        });

        it('should use the tsconfig for the configuration', async () => {

            findFilesStub.resolves([vscode.Uri.file('chaincode.ts')]);

            const fakeConfig: object = {
                compilerOptions: {
                    outDir: 'dist'
                }
            };

            mySandbox.stub(fs, 'readFile').resolves(JSON.stringify(fakeConfig));

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);

            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345'],
                outFiles: [path.join(workspaceFolder.uri.fsPath, 'dist', '**/*.js')],
                preLaunchTask: 'tsc: build - tsconfig.json'
            });
        });

        it('should not update the directory if it is an absolute path', async () => {

            findFilesStub.resolves([vscode.Uri.file('chaincode.ts')]);

            const fakeConfig: object = {
                compilerOptions: {
                    outDir: path.join(__dirname, 'mypath')
                }
            };

            mySandbox.stub(fs, 'readFile').resolves(JSON.stringify(fakeConfig));

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);

            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345'],
                outFiles: [path.join(workspaceFolder.uri.fsPath, '**/*.js')],
                preLaunchTask: 'tsc: build - tsconfig.json'
            });
        });

        it('should update path if not absolute path', async () => {

            findFilesStub.resolves([vscode.Uri.file('chaincode.ts')]);

            const fakeConfig: object = {
                compilerOptions: {
                    outDir: './dist'
                }
            };

            mySandbox.stub(fs, 'readFile').resolves(JSON.stringify(fakeConfig));

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);

            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345'],
                outFiles: [path.join(workspaceFolder.uri.fsPath, 'dist', '**/*.js')],
                preLaunchTask: 'tsc: build - tsconfig.json'
            });
        });

        it('should add to outfile if already set', async () => {

            findFilesStub.resolves([vscode.Uri.file('chaincode.ts')]);

            debugConfig.outFiles = ['cake'];

            const fakeConfig: object = {
                compilerOptions: {
                    outDir: 'dist'
                }
            };

            mySandbox.stub(fs, 'readFile').resolves(JSON.stringify(fakeConfig));

            const config: vscode.DebugConfiguration = await fabricDebugConfig.resolveDebugConfiguration(workspaceFolder, debugConfig);

            config.should.deep.equal({
                type: 'node2',
                request: 'myLaunch',
                name: 'Launch Program',
                program: 'myProgram',
                cwd: 'myCwd',
                env: { CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1' },
                args: ['start', '--peer.address', 'localhost:12345'],
                outFiles: ['cake', path.join(workspaceFolder.uri.fsPath, 'dist', '**/*.js')],
                preLaunchTask: 'tsc: build - tsconfig.json'
            });
        });
    });

    describe('dispose', () => {
        it('should dispose the config', () => {
            const fabricDebugConfig: FabricDebugConfigurationProvider = new FabricDebugConfigurationProvider();
            try {
                fabricDebugConfig.dispose();
            } catch (error) {
                throw new Error('should not get here');
            }
        });
    });
});
