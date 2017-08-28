
Vagrant.configure("2") do |config|
    config.vm.define 'db' do |node|
        node.vm.provider "virtualbox" do |v|
            v.memory = 512
        end
        node.vm.box = "bento/ubuntu-16.04"

        node.vm.network "forwarded_port", guest: 3306, host: 3306, host_ip: "127.0.0.1"
        node.vm.network "forwarded_port", guest: 5432, host: 5432, host_ip: "127.0.0.1"

        node.vm.provision "shell", path: 'node_modules/futoin-database/test/db_config.sh'
    end
end
